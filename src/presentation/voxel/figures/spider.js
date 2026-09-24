/* 幽谷蛛后 — Vale Spider Queen: a black armoured spider, glossy segmented plates, a great abdomen whose armour
 * petals frame a glowing emerald crystal, eight long jointed spiky legs, heavy fangs and a cluster of green eyes
 * (card spider). Own skeleton (kind "spider") and own clips: idle shuffle, rear-up-and-lunge bite, flinch, victory. */
EmberVoxelKit.define("spider", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, add, sub, mul, lerp, norm, cross, CLS, mats, sideName, spline } = K;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const D2R = Math.PI / 180, V = 0.0125;

  // ---------------------------------------------------------------- landmarks (facing +Z, +X = her left)
  const PRO = [0, 0.125, 0.035];                                  // prosoma (cephalothorax) centre = root
  const HEAD = [0, 0.14, 0.088];                                  // eye mound / fang base
  const PED = [0, 0.135, -0.03];                                  // pedicel = abdomen pivot
  const ABC = [0, 0.205, -0.15];                                  // abdomen centre
  const ABR = [0.112, 0.102, 0.122];                              // abdomen radii
  const ABT = 0.12;                                               // abdomen tilt (+ = rear end up)
  const WDW = norm([0, 0.56, 0.83]);                              // the crystal window faces forward and up (world)
  // legs (left side, mirrored): heading angle from +Z toward +X, knee / ankle as [radial, height], foot radial
  const LEG = [
    { phi: 30, knee: [0.13, 0.285], ankle: [0.245, 0.135], foot: 0.285 },
    { phi: 66, knee: [0.15, 0.305], ankle: [0.285, 0.14], foot: 0.325 },
    { phi: 108, knee: [0.145, 0.295], ankle: [0.275, 0.13], foot: 0.315 },
    { phi: 146, knee: [0.14, 0.28], ankle: [0.27, 0.12], foot: 0.31 },
  ];
  function legOf(i, s) {
    const L = LEG[i], a = L.phi * D2R, u = [s * Math.sin(a), 0, Math.cos(a)];
    const at = (r, y) => [PRO[0] + u[0] * r, y, PRO[2] + u[2] * r];
    return { u, lift: norm(cross(u, [0, 1, 0])), base: at(0.05, 0.118), knee: at(...L.knee), ankle: at(...L.ankle), foot: at(L.foot, 0.004) };
  }
  const LEGS = [];
  for (const s of [1, -1]) for (let i = 0; i < 4; i++) LEGS.push({ i, s, n: "leg" + (i + 1) + sideName(s), ...legOf(i, s) });
  const applyR = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  const applyRT = (R, v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];

  /* blade fin along segment a→b in the leg plane: rises `h` above the segment toward `up`, half thickness t across `side` */
  function fin(a, b, up, side, h, t) {
    const ab = sub(b, a), L = len(ab), d = mul(ab, 1 / L), n = norm(sub(up, mul(d, dot(up, d)))), sd = norm(side);
    const pts = [a, b, add(a, mul(n, h)), add(b, mul(n, h))], mn = [0, 1, 2].map((i) => Math.min(...pts.map((p) => p[i])) - t), mx = [0, 1, 2].map((i) => Math.max(...pts.map((p) => p[i])) + t);
    return S.custom((x, y, z) => {
      const px = x - a[0], py = y - a[1], pz = z - a[2], u = (px * d[0] + py * d[1] + pz * d[2]) / L;
      const v = px * n[0] + py * n[1] + pz * n[2], w = px * sd[0] + py * sd[1] + pz * sd[2];
      const hh = h * Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 0.6);
      return Math.max(Math.abs(w) - t, v - hh, -v - 0.004, (Math.abs(u - 0.5) - 0.5) * L);
    }, [...mn, ...mx]);
  }

  function spider() {
    const sc = new Sculpture();
    sc.bone("root", null, ...PRO);
    sc.bone("head", "root", ...HEAD);
    sc.bone("abdomen", "root", ...PED);
    for (const s of [1, -1]) {
      const n = sideName(s);
      sc.bone("fang" + n, "head", s * 0.021, 0.12, 0.108);
      sc.bone("palp" + n, "head", s * 0.036, 0.112, 0.098); sc.bone("palp" + n + "t", "palp" + n, s * 0.054, 0.072, 0.162);
    }
    for (const L of LEGS) { sc.bone(L.n + "a", "root", ...L.base); sc.bone(L.n + "b", L.n + "a", ...L.knee); sc.bone(L.n + "c", L.n + "b", ...L.ankle); sc.bone(L.n + "d", L.n + "c", ...L.foot); }
    mats(sc, {
      armor: { c: 0x3a444c, rough: 0.26, metal: 0.62, cls: CLS.metal, vary: 0.03 }, armorDk: { c: 0x1a1f23, rough: 0.35, metal: 0.4, cls: CLS.metal },
      armorHi: { c: 0x75848c, rough: 0.28, metal: 0.55, cls: CLS.metal }, fang: { c: 0x262c32, rough: 0.18, metal: 0.7, cls: CLS.metal },
      fangHi: { c: 0x56626b, rough: 0.15, metal: 0.7, cls: CLS.metal }, armorMid: { c: 0x66737c, rough: 0.25, metal: 0.6, cls: CLS.metal },
      gem: { c: 0x16a257, rough: 0.12, emit: 0.32, cls: CLS.glow }, gemHi: { c: 0x62e8a2, rough: 0.1, emit: 0.4, cls: CLS.glow },
      eye: { c: 0x3cd678, rough: 0.1, emit: 0.4, cls: CLS.glow }, venom: { c: 0x2cb862, rough: 0.2, emit: 0.3, cls: CLS.glow },
    });
    const A = { mat: "armor" };
    // ---- prosoma: domed carapace with a keel, the eye mound in front
    sc.add(S.ell(0.068, 0.04, 0.074), { ...A, p: PRO, bone: "root", k: 0.02 });
    sc.limb([0, PRO[1] + 0.028, PRO[2] - 0.055], [0, PRO[1] + 0.036, PRO[2] + 0.04], 0.011, 0.013, { ...A, bone: "root", k: 0.016, sx: 0.6 });   // keel
    const HR = [0.053, 0.036, 0.042];
    sc.add(S.ell(...HR), { ...A, p: HEAD, bone: "head", k: 0.018 });                                                                     // eye mound
    sc.add(S.ell(0.052, 0.02, 0.052), { mat: "armorDk", p: [0, PRO[1] - 0.03, PRO[2] + 0.005], bone: "root", k: 0.02 });                   // sternum
    // eyes: six green beads on the voxel lattice with dark gaps — two in front, two flanking lower, two above
    const cv = (m) => (m + 0.5) * V;
    for (const s of [1, -1]) for (const [i, j] of [[1, 11], [3, 11], [1, 13]]) {
      const x = cv(i), y = cv(j), zs = HEAD[2] + HR[2] * Math.sqrt(Math.max(0, 1 - (x / HR[0]) ** 2 - ((y - HEAD[1]) / HR[1]) ** 2));
      sc.add(S.sphere(0.0035), { mat: "eye", p: [s * x, y, cv(Math.round((zs + 0.005) / V - 0.5))], bone: "head", k: 0.001, vdil: 0.62 });
    }
    // chelicerae: bulbous glossy bases, lighter curved fangs with venom-green tips
    for (const s of [1, -1]) {
      const n = sideName(s), b0 = [s * 0.021, 0.12, 0.108];
      sc.add(S.ell(0.019, 0.032, 0.02), { mat: "fang", p: add(b0, [0, -0.02, 0.016]), r: [-0.35, 0, 0], bone: "fang" + n, k: 0.01 });
      const fp = spline([add(b0, [0, -0.046, 0.026]), add(b0, [s * 0.003, -0.072, 0.03]), add(b0, [-s * 0.009, -0.094, 0.014])], 6).map((p, i) => [...p, mix(0.0115, 0.003, i / 6)]);
      sc.add(S.chain(fp), { mat: "fangHi", p: [0, 0, 0], bone: "fang" + n, k: 0.004, vdil: 0.5 });
      sc.paint(S.sphere(0.012), { mat: "venom", p: fp[6].slice(0, 3), soft: 0.002, only: ["fangHi"] });
      // pedipalps: short feelers beside the fangs
      sc.limb([s * 0.036, 0.112, 0.098], [s * 0.054, 0.072, 0.162], 0.0085, 0.0055, { ...A, bone: "palp" + n, k: 0.004, vdil: 0.5 });
    }
    // ---- abdomen: emerald crystal inside an armour shell that opens in a window over the front
    const tilt = [ABT, 0, 0], Rt = K.rotm(...tilt), WD = applyRT(Rt, WDW);  // window direction in the abdomen frame
    const win = (x, y, z) => { const ex = x / ABR[0], ey = y / ABR[1], ez = z / ABR[2], l = Math.hypot(ex, ey, ez) || 1; return 0.74 - (ex * WD[0] + ey * WD[1] + ez * WD[2]) / l + 0.3 * Math.abs(ex) / l; };
    sc.add(S.ell(ABR[0] - 0.014, ABR[1] - 0.014, ABR[2] - 0.014), { mat: "gem", p: ABC, r: tilt, bone: "abdomen", k: 0.01 });
    const shell = S.ell(...ABR);                                                                            // a 2.2 cm crust with the window cut out
    sc.add(S.custom((x, y, z) => { const f = shell.f(x, y, z); return Math.max(f, -f - 0.022, -win(x, y, z) * 0.1); }, shell.b.map((v) => v * 1.08)), { ...A, p: ABC, r: tilt, bone: "abdomen", k: 0.004 });
    sc.limb(PED, add(PED, [0, 0.02, -0.05]), 0.02, 0.03, { ...A, bone: "abdomen", k: 0.012 });                                              // pedicel
    // a faceted crystal standing proud of the window, with a bright heart
    const wc = add(ABC, applyR(Rt, [WD[0] * ABR[0] * 0.9, WD[1] * ABR[1] * 0.9, WD[2] * ABR[2] * 0.9]));
    const oct = S.custom((x, y, z) => (Math.abs(x) / 0.045 + Math.abs(y) / 0.042 + Math.abs(z) / 0.062 - 1) * 0.022, [-0.045, -0.042, -0.062, 0.045, 0.042, 0.062]);
    sc.add(oct, { mat: "gem", p: wc, R: K.rotY2(...WDW), bone: "abdomen", k: 0.004, vdil: 0.3 });
    sc.paint(S.box(0.0095, 0.06, 0.032), { mat: "gemHi", p: add(wc, mul(WDW, 0.02)), R: K.rotY2(...WDW), soft: 0.002, only: ["gem"] });
    // petal seams: dark lines radiating over the shell from the window
    sc.paint(S.custom((x, y, z) => { const a = Math.atan2(x, z), b = Math.abs(((a / Math.PI) * 3 + 8.5) % 1 - 0.5); return (b - 0.07) * 0.2; }, [-1, -1, -1, 1, 1, 1]), { mat: "armorDk", p: ABC, r: tilt, soft: 0.001, only: ["armor"] });
    // raised petal edges along the seams, from the window rim round to the spinnerets
    for (let k = 1; k < 6; k++) {
      const az = (k / 6) * 2 * Math.PI, pts = [];
      for (let j = 0; j <= 8; j++) {
        const pol = (0.2 + 0.78 * (j / 8)) * Math.PI, e = [Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)];
        const loc = [e[0] * ABR[0] * 1.01, e[1] * ABR[1] * 1.01, e[2] * ABR[2] * 1.01];
        if (win(...loc) < 0.05) continue;
        pts.push([...add(ABC, applyR(Rt, loc)), 0.0045]);
      }
      if (pts.length > 1) sc.add(S.chain(pts), { mat: "armorMid", p: [0, 0, 0], bone: "abdomen", k: 0.003, vdil: 0.45 });
    }
    // thorns on the petal tips round the rim of the window
    const WX = [1, 0, 0], WY = norm(cross(WD, WX));
    for (let i = 0; i < 7; i++) {
      const be = (-0.78 + (i / 6) * 1.56) * Math.PI, ca = 0.62, sa = Math.sqrt(1 - ca * ca);
      const e = add(mul(WD, ca), add(mul(WX, sa * Math.sin(be)), mul(WY, sa * Math.cos(be))));
      const p0 = add(ABC, applyR(Rt, [e[0] * ABR[0], e[1] * ABR[1], e[2] * ABR[2]]));
      const dir = norm(add(applyR(Rt, [e[0] / ABR[0], e[1] / ABR[1], e[2] / ABR[2]]), [0, 16, 0]));
      sc.limb(p0, add(p0, mul(dir, 0.04 - 0.012 * Math.abs(Math.cos(be)))), 0.01, 0.0015, { mat: "armorHi", bone: "abdomen", k: 0.004, vdil: 0.5 });
    }
    // ---- legs: armoured rods with blade fins, pale joint collars, a thorn at every knee, needle tarsi
    for (const L of LEGS) {
      const up = [0, 1, 0];
      sc.add(S.sphere(0.018), { ...A, p: L.base, bone: L.n + "a", k: 0.008 });
      sc.limb(L.base, L.knee, 0.017, 0.0135, { ...A, bone: L.n + "a", k: 0.006 });
      sc.add(fin(lerp(L.base, L.knee, 0.12), lerp(L.base, L.knee, 0.92), sub(up, mul(L.u, 1.2)), L.lift, 0.02, 0.004), { mat: "armorDk", p: [0, 0, 0], bone: L.n + "a", k: 0.003, vdil: 0.45 });
      sc.add(S.sphere(0.015), { mat: "armorHi", p: L.knee, bone: L.n + "b", k: 0.004 });
      sc.limb(L.knee, add(L.knee, mul(norm(add(up, mul(L.u, -0.5))), 0.038)), 0.0085, 0.0015, { mat: "armorDk", bone: L.n + "b", k: 0.004, vdil: 0.5 });   // knee thorn
      sc.limb(L.knee, L.ankle, 0.0135, 0.01, { ...A, bone: L.n + "b", k: 0.005 });
      sc.add(fin(lerp(L.knee, L.ankle, 0.1), lerp(L.knee, L.ankle, 0.9), add(up, mul(L.u, 0.6)), L.lift, 0.014, 0.0035), { mat: "armorDk", p: [0, 0, 0], bone: L.n + "b", k: 0.003, vdil: 0.45 });
      sc.add(S.sphere(0.011), { mat: "armorHi", p: L.ankle, bone: L.n + "c", k: 0.003 });
      sc.limb(L.ankle, L.foot, 0.0095, 0.003, { ...A, bone: L.n + "c", k: 0.004, vdil: 0.5 });
    }
    return { sc, kind: "spider", props: [] };
  }

  // ---------------------------------------------------------------- motion
  // per leg, in the root bone's rest frame: base, rest directions and lengths of femur / tibia / tarsus, the tarsus vector
  for (const L of LEGS) {
    const d1 = sub(L.knee, L.base), d2 = sub(L.ankle, L.knee), d3 = sub(L.foot, L.ankle);
    Object.assign(L, { b: sub(L.base, PRO), l1: len(d1), l2: len(d2), d1: norm(d1), d2: norm(d2), d3: norm(d3), tv: sub(L.ankle, L.foot), pole: add(L.knee, add([0, 0.2, 0], mul(L.u, 0.05))) });
  }
  let H = null;
  const scratch = () => {
    if (H) return H;
    const T3 = EmberVesperThree, Q = () => new T3.Quaternion(), V3 = () => new T3.Vector3();
    return (H = { q: Q(), qi: Q(), qa: Q(), qb: Q(), qc: Q(), qab: Q(), v: V3(), w: V3(), a: V3(), f: V3(), k: V3(), p: V3(), d: V3(), r: V3(), e: V3() });
  };
  function spin(fig, name, ax, a) { const o = fig.J[name]; if (!o || !a) return; const h = scratch(); o.quaternion.multiply(h.q.setFromAxisAngle(h.v.set(ax[0], ax[1], ax[2]), a)); }
  /* plant a leg's foot at model-space point f with amount k: analytic two-bone IK (femur, tibia) in the root bone's frame,
   * knee toward a pole above it, tarsus aimed at the foot — plain quaternion maths, no world-matrix updates */
  function plant(fig, L, f, k) {
    if (k <= 0) return;
    const h = scratch(), J = fig.J, rt = J.root, qi = h.qi.copy(rt.quaternion).invert(), pr = rt.position;
    const toRoot = (out, x, y, z) => out.set(x - pr.x, y - pr.y, z - pr.z).applyQuaternion(qi);
    const aT = toRoot(h.a, f[0] + L.tv[0], f[1] + L.tv[1], f[2] + L.tv[2]), fT = toRoot(h.f, f[0], f[1], f[2]);
    const b = h.p.set(L.b[0], L.b[1], L.b[2]);
    const dir = h.d.copy(aT).sub(b), dl = dir.length(), d = Math.min(Math.max(dl, 1e-4), (L.l1 + L.l2) * 0.999);
    dir.multiplyScalar(1 / Math.max(dl, 1e-6));
    const pv = toRoot(h.r, L.pole[0], L.pole[1], L.pole[2]).sub(b);
    pv.addScaledVector(dir, -pv.dot(dir));
    if (pv.lengthSq() < 1e-10) pv.set(0, 1, 0); pv.normalize();
    const cosA = Math.min(1, Math.max(-1, (L.l1 * L.l1 + d * d - L.l2 * L.l2) / (2 * L.l1 * d))), sinA = Math.sqrt(1 - cosA * cosA);
    const kn = h.k.copy(b).addScaledVector(dir, L.l1 * cosA).addScaledVector(pv, L.l1 * sinA);   // knee
    const an = h.e.copy(b).addScaledVector(dir, d);                                                 // ankle reached
    // femur (local to root), tibia (local to femur), tarsus (local to tibia)
    h.qa.setFromUnitVectors(h.v.set(L.d1[0], L.d1[1], L.d1[2]), h.w.copy(kn).sub(b).normalize());
    h.qb.setFromUnitVectors(h.v.set(L.d2[0], L.d2[1], L.d2[2]), h.w.copy(an).sub(kn).normalize().applyQuaternion(h.qi.copy(h.qa).invert()));
    h.qab.copy(h.qa).multiply(h.qb);
    h.qc.setFromUnitVectors(h.v.set(L.d3[0], L.d3[1], L.d3[2]), h.w.copy(fT).sub(an).normalize().applyQuaternion(h.qi.copy(h.qab).invert()));
    J[L.n + "a"].quaternion.slerp(h.qa, k); J[L.n + "b"].quaternion.slerp(h.qb, k); J[L.n + "c"].quaternion.slerp(h.qc, k);
  }
  function pose(fig, clip, t, T, C) {
    const { rot, off, sstep, bump } = C;
    let glow = 0.12 * (0.5 + 0.5 * Math.sin(T * 1.6)), ret = clip === "idle" || t < 1;
    const ab = fig.J.abdomen;
    // idle base: the body sways and bobs, the abdomen breathes, palps and fangs twitch
    const sw = Math.sin(T * 0.8), bob = Math.sin(T * 2.1);
    rot(fig, "root", 0.015 * bob, 0.04 * sw, 0.01 * Math.sin(T * 1.3));
    off(fig, "root", 0.004 * sw, 0.004 * bob, 0);
    rot(fig, "abdomen", 0.04 * Math.sin(T * 1.05 + 0.6), 0.05 * Math.sin(T * 0.8 - 0.8), 0);
    if (ab) ab.scale.setScalar(1 + 0.018 * Math.sin(T * 2.1 - 0.5));
    for (const s of ["L", "R"]) {
      const ph = s === "L" ? 0 : 1.3;
      rot(fig, "palp" + s, 0.15 * Math.max(0, Math.sin(T * 3.1 + ph)) - 0.05, 0, 0);
      rot(fig, "fang" + s, 0.06 * Math.max(0, Math.sin(T * 0.9 + ph) - 0.7) * 3, 0, 0);
    }
    let rearF = 0, lunge = 0, curl = 0;
    if (clip === "attack") {
      // rear up, forelegs raised and fangs spread (0-0.28) → lunge and bite at 0.42 → hold → recover (→1.1)
      const up = sstep(0, 0.26, t) * (1 - sstep(0.3, 0.42, t));
      const go = sstep(0.28, 0.42, t) * (1 - sstep(0.62, 1.05, t));
      const bite = bump(0.34, 0.42, 0.55, 0.7, t), shake = bump(0.42, 0.45, 0.55, 0.62, t) * Math.sin(t * 80) * 0.02;
      rot(fig, "root", -0.42 * up + 0.12 * go + 0.1 * bite + shake, 0.04 * sw * (1 - up), 0);
      off(fig, "root", 0, 0.045 * up - 0.014 * go, -0.035 * up + 0.125 * go);
      rot(fig, "abdomen", 0.34 * up - 0.12 * go, 0, 0);
      for (const s of ["L", "R"]) { rot(fig, "fang" + s, -0.5 * up + 0.35 * bite, (s === "L" ? 1 : -1) * 0.35 * (up - bite * 0.5), 0); rot(fig, "palp" + s, -0.6 * up, 0, 0); }
      rearF = up; lunge = go;
      glow += 0.3 * up + 0.8 * bite;
      ret = t < 1.1;
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * sstep(0, 0.05, t);
      rot(fig, "root", -0.2 * k, 0, 0.1 * k); off(fig, "root", 0, -0.015 * k, -0.06 * k);
      rot(fig, "abdomen", 0.25 * k, 0, -0.1 * k);
      curl = k;
      ret = t < 0.6;
    } else if (clip === "victory") {
      // rear up and drum the forelegs, abdomen raised, then settle
      const up = bump(0, 0.3, 1.0, 1.4, t);
      rot(fig, "root", -0.34 * up, 0.04 * sw, 0); off(fig, "root", 0, 0.03 * up, -0.02 * up);
      rot(fig, "abdomen", 0.2 * up, 0, 0);
      rearF = up; glow += 0.5 * up;
      ret = t < 1.4;
    }
    // legs: forelegs rise (FK) when rearing, everything else stays planted by IK; a flinch curls every leg in.
    // Idle feet ripple round the body (L4 → L1, R1 → R4), one leg lifting and resettling at a time
    for (const L of LEGS) {
      const order = L.s > 0 ? 3 - L.i : 4 + L.i, step = bump(0, 0.35, 0.55, 0.95, ((T / 3.6 + order / 8) % 1) * 8) * 0.016;
      const front = L.i < 2, raise = front ? rearF * (L.i === 0 ? 1 : 0.7) : 0;
      const wave = raise * (L.i === 0 ? 0.25 * Math.sin(T * 9 + (L.s > 0 ? 0 : 1.6)) : 0);
      if (raise > 0) {
        // threat display: femur up, swung in front of the face, tibia and tarsus thrown up and forward
        const f1 = L.i === 0;
        spin(fig, L.n + "a", [0, 1, 0], -L.s * (f1 ? 0.5 : 0.25) * raise);
        spin(fig, L.n + "a", L.lift, ((f1 ? 0.15 : 0.1) + wave) * raise);
        spin(fig, L.n + "b", L.lift, (f1 ? 0.7 : 0.45) * raise); spin(fig, L.n + "c", L.lift, (f1 ? 0.3 : 0.2) * raise);
      }
      if (curl > 0) { spin(fig, L.n + "a", L.lift, 0.35 * curl); spin(fig, L.n + "b", L.lift, -0.9 * curl); spin(fig, L.n + "c", L.lift, -0.8 * curl); }
      const reach = front ? lunge * (L.i === 0 ? 0.13 : 0.07) : lunge * 0.03;
      const f = add(L.foot, [0, step + (front ? 0.02 * lunge * (1 - lunge) : 0), 0]);
      f[2] += reach;
      plant(fig, L, f, (1 - raise) * (1 - curl));
    }
    C.emitBoost(fig, glow);
    return ret;
  }

  return {
    cards: ["spider"], kind: "spider", build: spider, scale: 1.1, pose,
    moves: { attack: { clip: "lunge", hit: 0.42, length: 1.1, style: "bite", tint: 0x5cff8a } },
  };
})());
