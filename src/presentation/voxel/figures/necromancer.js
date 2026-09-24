/* 亡者织梦师 — the dream-weaver of the dead (card necromancer): a pale woman in a deep black hood lined with royal
 * blue, long black robes with blue bands and wide sleeves, a black cloak to the ground; she holds a teal ghost-lantern
 * up in her left hand and weaves with the right. The lantern hangs on its own bone (posed upright under the fist by
 * pose()); the spell leaves her right palm, thrust at the target while the lantern flares overhead. */
EmberVoxelKit.define("necromancer", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, rotY2, add, sub, mul, lerp, norm,
    FAM, CLS, mats, armJoints, sideName, humanoidBones, body, RG, wrap, bell, strand, onEll } = K;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  // flat-topped hexagon (apothem a) in XZ
  const hex = (x, z, a) => Math.max(Math.abs(x) * 0.866 + Math.abs(z) * 0.5, Math.abs(z)) - a;

  // ------------------------------------------------------------ prop: the ghost lantern (origin at the hanging ring)
  function lanternProp() {
    const sc = new Sculpture();
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      iron: { c: 0x3c3f4c, rough: 0.4, metal: 0.9, cls: CLS.metal, vary: 0.05 }, ironL: { c: 0x8a93a8, rough: 0.3, metal: 1, cls: CLS.metal },
      core: { c: 0xe4fdff, rough: 0.3, emit: 1.7, cls: CLS.glow }, glass: { c: 0x58c6cf, rough: 0.3, emit: 1.0, cls: CLS.glow },
      tassel: { c: 0x243c8c, rough: 0.9, cls: CLS.cloth },
    });
    const o = { bone: "p" }, g = 1.2;
    sc.add(S.torus(0.011 * g, 0.0032), { ...o, mat: "iron", p: [0, -0.008 * g, 0], r: [Math.PI / 2, 0, 0], k: 0.001, vdil: 0.6 });
    // cap: hexagonal pyramid with a knob
    sc.add(S.custom((x, y, z) => Math.max(hex(x, z, 0.012 * g + (-0.02 * g - y) * 0.9), y + 0.02 * g, -0.045 * g - y), pad([-0.045, -0.05, -0.045, 0.045, -0.015, 0.045], 0.01)), { ...o, mat: "iron", k: 0.001 });
    // cage: glowing glass body, six iron posts, rims top and bottom
    const y0 = -0.046 * g, y1 = -0.13 * g, ap = 0.034 * g;
    sc.add(S.custom((x, y, z) => Math.max(hex(x, z, ap - 0.004), y - y0, y1 - y), pad([-0.04, y1, -0.04, 0.04, y0, 0.04], 0.01)), { ...o, mat: "glass", k: 0.001 });
    sc.add(S.cyl(0.02 * g, 0.018 * g), { ...o, mat: "core", p: [0, (y0 + y1) / 2, 0], k: 0.002 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6, rr = ap / 0.866;
      sc.limb([Math.cos(a) * rr, y0, Math.sin(a) * rr], [Math.cos(a) * rr, y1, Math.sin(a) * rr], 0.0042, 0.0042, { ...o, mat: "iron", k: 0.001, vdil: 0.6 });
    }
    for (const [y, m] of [[y0, "ironL"], [y1, "iron"]]) sc.add(S.custom((x, yy, z) => Math.max(hex(x, z, ap + 0.004), Math.abs(yy - y) - 0.005), pad([-0.05, y - 0.006, -0.05, 0.05, y + 0.006, 0.05], 0.01)), { ...o, mat: m, k: 0.001 });
    // base finial and a blue tassel
    sc.limb([0, y1 - 0.004, 0], [0, y1 - 0.028 * g, 0], 0.012, 0.004, { ...o, mat: "iron", k: 0.001 });
    sc.limb([0, y1 - 0.03 * g, 0], [0, y1 - 0.075 * g, 0], 0.0045, 0.009, { ...o, mat: "tassel", k: 0.002, vdil: 0.6 });
    return sc;
  }

  function hair(sc, P, q) {
    const ey = P.eyeY, C = add(P.cranC, [0, 0.004, -0.006]), cr = P.cran, R = [cr[0] * 1.06, cr[1] * 1.05, cr[2] * 1.07];
    sc.add(S.minus(S.ell(...R), S.at(S.ell(cr[0] * 0.92, cr[1] * 0.76, cr[2] * 0.7), 0, -cr[1] * 0.5, cr[2] * 0.68), 0.012), { mat: "hair", p: C, bone: "head", k: 0.006 });
    // centre-parted curtain fringe, swept to the temples (kept above the brows)
    for (const s of [1, -1]) for (let i = 0; i < 4; i++) {
      const u = i / 3;
      const root = [s * 0.004, C[1] + R[1] * (0.62 - 0.06 * u), C[2] + R[2] * (0.72 + 0.08 * u)];
      const mid = [s * R[0] * (0.3 + 0.12 * u), ey + 0.058 + 0.004 * u, P.faceZ + 0.003 * q];
      const tip = [s * R[0] * (0.8 + 0.12 * u), ey + 0.03 - 0.022 * u, P.faceZ - 0.016 * q - 0.012 * q * u];
      strand(sc, [root, mid, tip], (0.011 + 0.002 * (1 - u)) * q, 0.0018 * q, { k: 0.007, taper: 1.2 });
    }
    strand(sc, [[0.002, C[1] + R[1] * 0.66, C[2] + R[2] * 0.7], [-0.004 * q, ey + 0.062, P.faceZ + 0.004 * q], [-0.014 * q, ey + 0.046, P.faceZ + 0.002 * q]], 0.011 * q, 0.003 * q, { k: 0.007, taper: 1.1 });
    // long locks falling out of the hood over the collarbones
    for (const s of [1, -1]) for (let j = 0; j < 3; j++) {
      const o = j - 1, n = sideName(s);
      const root = onEll(C, R, s * (1.18 + 0.1 * o), 0.12, 0.98);
      const a = [s * R[0] * (1.06 + 0.04 * o), ey - 0.02 * q, C[2] + R[2] * (0.5 - 0.1 * o)];
      const b = [s * R[0] * (1.08 + 0.05 * o), P.chinY - 0.03 * q, C[2] + R[2] * (0.6 - 0.1 * o)];
      const tip = [s * P.shX * (0.55 + 0.08 * o), P.neck[0] - 0.09 * q + 0.01 * Math.abs(o), P.chest[3] + 0.028 - 0.01 * o];
      const sp = strand(sc, [root, a, b, tip], (0.013 - 0.001 * Math.abs(o)) * q, 0.0025 * q, { wave: 0.006 * q, wd: [s, 0, 0.3], waves: 2.2, phase: j * 1.3, k: 0.01, wg: 4, swell: 0.2, bone: "hair" + n });
      sp.wfn = (x, y) => { const t = sstep(P.chinY, P.chinY - 0.12, y); return [["head", 1 - t], ["hair" + n, t]]; };
    }
  }

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), q = fam === "chunky" ? 1.25 : 1;
    humanoidBones(sc, P);
    const capeTop = P.shY + 0.008, capeBot = 0.02, capeZ = -P.chest[3] - 0.03;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("hairL", "head", 0.05, P.eyeY - 0.03, 0.03); sc.bone("hairR", "head", -0.05, P.eyeY - 0.03, 0.03);
    const aL = armJoints(P, 1), grip = add(aL.W, mul(aL.dir, 0.044 * P.hand)), hang = add(grip, [0, -0.012, 0]);
    sc.bone("lantern", "handL", ...hang);
    mats(sc, {
      skin: { c: 0xf0dcd4, rough: 0.55, cls: CLS.skin, vary: 0.015 }, skinDeep: { c: 0xd6b4ae, rough: 0.6, cls: CLS.skin },
      lips: { c: 0x8e3444, rough: 0.4, cls: CLS.lips },
      hair: { c: 0x221d2c, rough: 0.55, cls: CLS.hair, vary: 0.12 },
      robe: { c: 0x353850, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, robeD: { c: 0x1d1e2a, rough: 0.9, cls: CLS.cloth },
      blue: { c: 0x3d60d0, rough: 0.8, cls: CLS.cloth, vary: 0.05 }, blueD: { c: 0x2a4096, rough: 0.85, cls: CLS.cloth },
      silver: { c: 0x7c849a, rough: 0.3, metal: 1, cls: CLS.metal },
      sash: { c: 0x2a2433, rough: 0.6, cls: CLS.leather, vary: 0.06 },
      soul: { c: 0x6fd2da, rough: 0.3, emit: 0.9, cls: CLS.glow },
    });
    body(sc, P, fam, { elf: false });
    const X0 = P.shX * 0.93;
    // ---- torso: black bodice under a crossed neckline, blue inner collar
    const upArm = [1, -1].map((s) => { const a = armJoints(P, s); return RG.seg(add(a.S, mul(sub(a.S, a.E), 0.55)), lerp(a.S, a.E, 1.02), 0.085); });
    wrap(sc, RG.or(RG.box(-X0 * 1.3, X0 * 1.3, P.hipY - 0.12, P.neck[0] + 0.03), ...upArm), "robe", 0.006 * q);
    // crossed lapels: a blue band along each side of a V down to the sash
    const vw = (y) => 0.004 + Math.max(0, y - 0.58) * 0.28;
    sc.paint(S.custom((x, y, z) => (z > 0.02 && y < P.neck[0] + 0.03 ? Math.abs(Math.abs(x) - vw(y) - 0.008) - 0.008 : 1), [-0.3, -0.3, -0.3, 0.3, 1.2, 0.3]), { mat: "blue", soft: 0.001, only: ["robe"] });
    // wide sleeves from above the elbow to past the wrist, blue lining, silver band
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      const top = lerp(a.S, a.E, 0.65), end = add(a.W, mul(a.dir, 0.01)), d = norm(sub(end, top)), L = Math.hypot(...sub(end, top));
      const rs = (u) => mix(0.046, 0.074, Math.pow(u, 1.4)), Rs = rotY2(...d), inS = (x, z) => Math.hypot(x, z) - rs(1) - 0.014;
      const sl = sc.add(S.custom((x, y, z) => { const u = clamp(y / L, 0, 1); return Math.max(Math.hypot(x, z) - rs(u), -y, y - L); }, [-0.09, -0.01, -0.09, 0.09, L + 0.01, 0.09]),
        { mat: "robe", p: top, R: Rs, bone: "fore" + n, k: 0.004, cs: 0.03, sigma: 0.006 });
      const tE = dot(sub(a.E, top), d) / L;
      sl.wfn = (x, y, z) => { const t = dot(sub([x, y, z], top), d) / L, w = sstep(tE - 0.12, tE + 0.1, t); return [["arm" + n, 1 - w], ["fore" + n, w]]; };
      sc.paint(S.custom((x, y, z) => Math.max(L - 0.008 - y, inS(x, z)), [-1, -1, -1, 1, 1, 1]), { mat: "blue", p: top, R: Rs, soft: 0.001, only: ["robe"] });
      sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - (L - 0.026)) - 0.006, inS(x, z)), [-1, -1, -1, 1, 1, 1]), { mat: "blue", p: top, R: Rs, soft: 0.001, only: ["robe"] });
    }
    // ---- cloth: floor-length robe, sash, mantle, cloak, hood
    sc.part = "cloth";
    const y0 = P.waist[0] - 0.01, y1 = 0.004, r0 = 0.088, r1 = 0.2, szs = 0.84, h = y0 - y1, zc = -0.004;
    const rAt = (u) => mix(r0, r1, Math.pow(u, 0.62));
    const skirtS = S.custom((x, y, z) => {
      const u = clamp(-y / h, 0, 1), a = Math.atan2(z / szs, x);
      return Math.max((Math.hypot(x, z / szs) - rAt(u) - 0.009 * u * Math.sin(a * 8 + 0.6)) * 0.85, y, -y - h);
    }, [-r1 - 0.02, -h, -(r1 + 0.02) * szs, r1 + 0.02, 0, (r1 + 0.02) * szs]);
    const sk = sc.add(skirtS, { mat: "robe", p: [0, y0, zc], bone: "root", k: 0.003, cs: 0.03, wg: 3 });
    sk.wfn = (x, y) => { const u = clamp((y0 - y) / h, 0, 1), b = u * 0.6, sl = sstep(-0.03, 0.03, x); return [["root", 1 - b], ["thighL", b * sl], ["thighR", b * (1 - sl)]]; };
    // two blue bands down the front, a blue hem, dark underside
    const panel = (y) => 0.02 + 0.03 * clamp((y0 - y) / h, 0, 1);
    sc.paint(S.custom((x, y, z) => (z > 0.03 ? Math.abs(Math.abs(x) - panel(y) - 0.008) - 0.008 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "blue", soft: 0.001, only: ["robe"] });
    sc.paint(S.custom((x, y, z) => Math.abs(y - (y1 + 0.02)) - 0.0065, [-1, -1, -1, 1, 1, 1]), { mat: "blue", soft: 0.001, only: ["robe"] });
    sc.paint(S.custom((x, y, z) => y - (y1 + 0.009), [-1, -1, -1, 1, 1, 1]), { mat: "robeD", soft: 0.001, only: ["robe"] });
    // sash with silver rings and a hanging charm cord
    const yb = y0 + 0.004, sash = S.custom((x, y, z) => Math.max(Math.hypot(x, (z - zc) / 0.84) - 0.098, Math.abs(y - yb) - 0.022), pad([-0.11, yb - 0.03, -0.1, 0.11, yb + 0.03, 0.1], 0.01));
    sc.add(sash, { mat: "sash", p: [0, 0, 0], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.003, cs: 0.03, wg: 3 });
    for (const x of [0.03]) sc.add(S.torus(0.011, 0.0035), { mat: "silver", p: [x, yb, zc + 0.084], r: [Math.PI / 2, 0, 0], bone: "spine", bones: [["spine", 0.5], ["root", 0.5]], k: 0.001, vdil: 0.6 });
    const cord = sc.add(S.chain([[0.03, yb - 0.012, zc + 0.086, 0.0035], [0.034, yb - 0.06, zc + 0.098, 0.0035], [0.037, yb - 0.1, zc + 0.11, 0.0035]]), { mat: "silver", p: [0, 0, 0], bone: "root", k: 0.001, vdil: 0.6 });
    cord.wfn = sk.wfn;
    sc.add(S.box(0.009, 0.013, 0.004), { mat: "soul", p: [0.038, yb - 0.113, zc + 0.113], bone: "root", k: 0.001, vdil: 0.6 }).wfn = sk.wfn;
    // shoulder mantle: black over the shoulders, blue hem
    const mTop = P.neck[0] + 0.016 * q, mBot = P.chest[0] - 0.02 * q;
    bell(sc, mTop, mBot, P.neck[2] * 1.9, P.shX + P.delt * 1.3, "robe", { t: 0.0075, sz: (P.chest[3] * 1.75) / (P.shX + P.delt), folds: 9, amp: 0.006 * q, z: -0.012, slit: 0.04 * q, pw: 0.45, bones: [["chest", 1]] });
    sc.paint(S.custom((x, y, z) => Math.max(y - (mBot + 0.012), mBot - 0.012 - y, Math.hypot(x, z) - 0.24, 0.1 - Math.hypot(x, z * 1.3)), [-1, -1, -1, 1, 1, 1]), { mat: "blue", soft: 0.001, only: ["robe"] });
    // cloak: from the shoulders to the floor behind, wraps round the sides; blue lining
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.12, 0.27, Math.pow(u, 0.7));
      return { u, w, zc: mix(capeZ, capeZ - 0.07, u) - 0.016 * Math.sin((x / w) * 5 * 1.57 + 0.5) * (0.25 + u) + (0.8 - 0.3 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.0065, Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + 0.008 * (1 + Math.sin(x * 40 + 0.6)) - y), 0.006); };
    const cp = sc.add(S.custom(capeF, [-0.3, capeBot, -0.26, 0.3, capeTop, 0.1]), { mat: "robe", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > 0.07 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.3, capeBot, -0.26, 0.3, capeTop, 0.1]), { mat: "blueD", soft: 0.001, only: ["robe"] });
    // blue edges down the cloak's sides and a sigil band across the shoulders at the back
    sc.paint(S.custom((x, y, z) => (z > 0.07 || y > capeTop + 0.01 ? 1 : capeZc(x, y).w - 0.016 - Math.abs(x)), [-0.3, capeBot, -0.26, 0.3, capeTop, 0.1]), { mat: "blue", soft: 0.001, only: ["robe"] });
    sc.paint(S.custom((x, y, z) => (z > -0.06 ? 1 : Math.abs(y - 0.6) - 0.0065), [-0.3, 0.5, -0.3, 0.3, 0.7, 0]), { mat: "blue", soft: 0.001, only: ["robe"] });
    // hood (up): deep, hugging the hair, open over the face, falling to the shoulders behind; blue lining
    const hc = add(P.cranC, [0, -P.cran[1] * 0.02, -P.cran[2] * 0.08]), hr = [P.cran[0] * 1.3, P.cran[1] * 1.24, P.cran[2] * 1.3], ht = 0.0075;
    const hoodSolid = S.union(S.ell(...hr), S.at(S.ell(hr[0] * 1.0, hr[1] * 0.95, hr[2] * 0.8), 0, -hr[1] * 0.78, -hr[2] * 0.38), 0.03);
    const inner = S.union(S.ell(hr[0] - ht * 2, hr[1] - ht * 2, hr[2] - ht * 2), S.at(S.ell(hr[0] - ht * 2, hr[1] * 0.95 - ht * 2, hr[2] * 0.8 - ht * 2), 0, -hr[1] * 0.78, -hr[2] * 0.38), 0.03);
    const faceOpen = S.at(S.ell(P.face[0] * 1.5, (P.crown - P.chinY) * 0.64, 0.12), 0, (P.eyeY - hc[1]) - 0.008, (P.faceZ - hc[2]) + 0.075);
    const hood = sc.add(S.minus(S.minus(hoodSolid, inner), faceOpen, 0.004), { mat: "robe", p: hc, bone: "head", k: 0.006, cs: 0.03 });
    hood.wfn = (x, y) => { const u = sstep(P.chinY, P.neck[0] - 0.01, y); return [["head", 1 - u], ["neck", u * 0.5], ["chest", u * 0.5]]; };
    sc.paint(S.union(S.ell(hr[0] - ht, hr[1] - ht, hr[2] - ht), S.at(S.ell(hr[0] - ht, hr[1] * 0.95 - ht, hr[2] * 0.8 - ht), 0, -hr[1] * 0.78, -hr[2] * 0.38), 0.03), { mat: "blue", p: hc, soft: 0.002, only: ["robe"] });
    // a blue rim round the hood's opening, so the hood reads against the hair
    sc.paint(S.custom((x, y, z) => faceOpen.f(x, y, z) - 0.014, [-1, -1, -1, 1, 1, 1]), { mat: "blue", p: hc, soft: 0.001, only: ["robe"] });
    // silver circlet chain across the forehead under the hood, a soul-glass drop at the centre
    sc.add(S.box(0.006, 0.008, 0.004), { mat: "soul", p: [0, P.eyeY + 0.062, P.faceZ - 0.006], bone: "head", k: 0.001, vdil: 0.6 });
    sc.part = "hair";
    hair(sc, P, q);
    sc.part = "body";
    return { sc, P, kind: "humanoid", props: [{ sc: lanternProp(), bone: "lantern", at: hang }] };
  }

  // ------------------------------------------------------------------ motion
  let TQ = null;
  const three = () => TQ || (TQ = { T: EmberVesperThree, q1: new EmberVesperThree.Quaternion(), q2: new EmberVesperThree.Quaternion(), q3: new EmberVesperThree.Quaternion(), e: new EmberVesperThree.Euler() });
  /** world position of a fist's grip (model space) */
  function fistM(fig, C, name) {
    const a = armJoints(fig.char.P, name === "handL" ? 1 : -1), h = fig.J[name];
    fig.root.updateMatrixWorld(true);
    return C.toM(fig, h.localToWorld(C.V3(...a.dir).multiplyScalar(0.044 * fig.char.P.hand)));
  }
  /** hang the lantern under the left fist, upright in the figure's frame, swinging by (sx, sz) */
  function hangLantern(fig, C, sx, sz) {
    const { q1, q2, q3, e } = three(), o = fig.J.lantern, h = fig.J.handL;
    if (!o) return;
    const m = fistM(fig, C, "handL").add(C.V3(0, -0.012, 0));
    o.position.copy(h.worldToLocal(C.toW(fig, m)));
    h.getWorldQuaternion(q1).invert();
    fig.root.getWorldQuaternion(q2);
    q3.setFromEuler(e.set(sx, 0.3, sz));
    o.quaternion.copy(q1.multiply(q2).multiply(q3));
    o.updateMatrixWorld(true);
  }
  /** turn a hand toward the figure's frame rotated by ez about Z (amount k): -2.57 stands the right fist up, +Z forward */
  function orientHand(fig, C, name, ez, k) {
    const { T, q1, q2, q3, e } = three(), h = fig.J[name];
    if (!h || k <= 0) return;
    fig.root.updateMatrixWorld(true);
    h.getWorldQuaternion(q1).slerp(fig.root.getWorldQuaternion(q2).multiply(q3.setFromEuler(e.set(0, 0, ez))), k);
    h.quaternion.copy(h.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q1));
    h.updateMatrixWorld(true);
  }

  function pose(fig, clip, t, T, C) {
    const V = C.V3, br = Math.sin((T * C.TAU) / 3.4);
    const shift = (x, y, z) => fig.J.root.position.add(V(x, y, z));
    C.base(fig, "idle", 0, T);
    fig.root.updateMatrixWorld(true);
    const shL = C.toM(fig, C.wpos(fig.J.armL)), shR = C.toM(fig, C.wpos(fig.J.armR));
    // idle: lantern held up and out on the left, right hand open in front of the waist, weaving
    let lh = V(shL.x + 0.1, shL.y + 0.05 + 0.006 * br, shL.z + 0.13), rh = V(shR.x + 0.02 + 0.015 * Math.sin(T * 1.3), shR.y - 0.2 + 0.012 * Math.sin(T * 1.7), shR.z + 0.15);
    let sx = 0.07 * Math.sin(T * 2.1), sz = 0.06 * Math.sin(T * 1.6), glow = 0.12 * (0.5 + 0.5 * Math.sin(T * 2.3)), face = null, palm = 0, done;
    if (clip === "idle") done = true;
    else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      C.addRot(fig, "spine", -0.22 * k, 0, 0.12 * k); C.addRot(fig, "chest", -0.28 * k, 0, 0.08 * k); C.addRot(fig, "head", -0.3 * k, 0.2 * k, 0.12 * k);
      shift(0, -0.02 * k, -0.05 * k);
      lh.add(V(0.04 * k, 0.05 * k, -0.06 * k)); rh.add(V(-0.04 * k, 0.06 * k, -0.04 * k));
      sx -= 0.6 * k; glow *= 1 - 0.8 * k;
      face = t < 0.45 ? "hurt" : null; done = t < 0.6;
    } else if (clip === "victory") {
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      C.addRot(fig, "chest", -0.12 * up, 0, 0); C.addRot(fig, "head", -0.22 * up, 0, 0);
      lh.lerp(V(shL.x + 0.02, shL.y + 0.28, shL.z + 0.06), up);
      rh.lerp(V(shR.x - 0.08, shR.y - 0.02, shR.z + 0.18), up);
      glow += 1.0 * up; sx += 0.15 * Math.sin(t * 7) * up;
      face = up > 0.3 ? "closed" : null; done = t < 1.6;
    } else if (clip === "attack") {
      // lift the lantern high and draw the right hand back to the shoulder (0-0.3) → thrust the palm, release at 0.42
      const ch = C.bump(0.02, 0.28, 0.32, 0.42, t), th = C.bump(0.32, 0.42, 0.6, 1.05, t), rel = C.bump(0.4, 0.43, 0.5, 0.75, t);
      const lift = C.sstep(0.02, 0.3, t) * (1 - C.sstep(0.62, 1.05, t));
      C.addRot(fig, "root", 0.05 * th, 0.3 * ch - 0.2 * th, 0);
      shift(0, -0.012 * ch - 0.02 * th, -0.02 * ch + 0.05 * th);
      C.addRot(fig, "spine", -0.06 * ch + 0.1 * th, 0.1 * ch - 0.1 * th, 0);
      C.addRot(fig, "chest", -0.1 * ch + 0.08 * th, 0.14 * ch - 0.12 * th, 0);
      C.addRot(fig, "head", -0.06 * ch - 0.04 * th, -0.25 * ch + 0.15 * th, 0);
      fig.root.updateMatrixWorld(true);
      const sL = C.toM(fig, C.wpos(fig.J.armL)), sR = C.toM(fig, C.wpos(fig.J.armR)), reach = (fig.char.P.upArm + fig.char.P.foreArm) * 0.95;
      lh = V(sL.x + 0.1, sL.y + 0.05 + 0.006 * br, sL.z + 0.13).lerp(V(sL.x + 0.03, sL.y + 0.27, sL.z + 0.07), lift);
      rh = V(shR.x + 0.02, shR.y - 0.2, shR.z + 0.15).lerp(V(sR.x - 0.02, sR.y + 0.02, sR.z - 0.02), ch).lerp(V(sR.x + 0.07, sR.y - 0.02, sR.z + reach), th);
      palm = th;
      sx += 0.4 * ch - 0.5 * th; glow += 0.5 * lift + 1.4 * rel;
      face = t > 0.04 && t < 0.36 ? "focus" : th > 0.3 ? "fierce" : null; done = t < 1.2;
    } else return undefined;
    fig.root.updateMatrixWorld(true);
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, lh), C.toW(fig, V(shL.x + 0.35, shL.y - 0.25, shL.z - 0.15)), 1);
    C.ik(fig, "armR", "foreR", "handR", C.toW(fig, rh), C.toW(fig, V(shR.x - 0.3, shR.y - 0.25, shR.z - 0.1)), 1);
    orientHand(fig, C, "handR", -2.57, palm);
    // the hood and cloak trail a little behind a thrust
    for (const s of ["L", "R"]) C.addRot(fig, "cape1" + s, 0.1 * palm, 0, 0);
    hangLantern(fig, C, sx, sz);
    C.emitBoost(fig, glow);
    if (face) C.setFace(fig, face);
    return done;
  }

  return {
    cards: ["necromancer"], kind: "humanoid", build, pose, scale: 1.0,
    face: { kind: "human", look: { eye: 0x7d86b8, brow: "#1b1622", lash: "#0e0b12", lip: "#8e3444", skinD: "#d6b4ae" } },
    moves: { attack: { clip: "weave", hit: 0.42, length: 1.2, style: "bolt", ranged: true, windup: 280, emitter: { bone: "handR", offset: [0, 0, 0.06] } } },
  };
})());
