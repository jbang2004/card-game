/* 守灯巨兽 — Moonguard (card moonguard): a colossal moon-knight in bright silver plate — a close helm with a beaked
 * visor that burns pale blue and two tall horns sweeping up off the crown, long white hair streaming from under it,
 * a sweeping royal-blue cape — behind a tower shield nearly his own height: deep blue field, silver rim, a glowing
 * silver crescent cradling a four-point star (the lamp he guards). The shield has its own bone: pose() carries it on
 * the left fist; the attack is a shield bash. */
EmberVoxelKit.define("moonguard", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, add, sub, mul, lerp, norm, cross,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, strand, onEll } = K;
  const V = 0.0125;
  const row = (j) => (j + 0.5) * V;
  const angD = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];

  /* curved plate round an axis (see guard.js): point A, unit axis d, angle 0 toward `ref`; axial t0..t1,
   * |angle - ac| < am, radius R (+ flare toward t1), half thickness th */
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

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), PX = K.pixel;   // PX: pixel-sprite variant (few big hair locks, clean shield)
    humanoidBones(sc, P);
    const capeTop = P.shY - 0.01, capeBot = 0.08, capeZ = -0.115;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("hairB1", "head", 0, P.eyeY - 0.02, -0.09); sc.bone("hairB2", "hairB1", 0, P.neck[0] - 0.03, -0.12);
    // shield grip at rest, in front of the left hip and clear of the body, on cube boundaries (symmetric emblem)
    const G = [10 * V, 34 * V, 13 * V];
    sc.bone("shield", "chest", ...G);
    mats(sc, PX ? {
      // matte and clearly stepped: steel plate, a dark joint tone, a bright trim, snow-white hair, deep blue cloth
      skin: { c: 0x3a4152, rough: 0.6, cls: CLS.metal }, lips: { c: 0x3a4152, rough: 0.6, cls: CLS.metal },
      plate: { c: 0x98a7c2, rough: 0.5, metal: 0.15, cls: CLS.metal },
      plateM: { c: 0x8593b0, rough: 0.5, metal: 0.15, cls: CLS.metal },
      plateD: { c: 0x535d76, rough: 0.55, metal: 0.15, cls: CLS.metal },
      plateL: { c: 0xd2dcf0, rough: 0.45, metal: 0.15, cls: CLS.metal },
      visor: { c: 0x8ec8ff, rough: 0.4, emit: 1.7, cls: CLS.glow },
      hair: { c: 0xf4f6fb, rough: 0.7, cls: CLS.hair },
      blue: { c: 0x2f4fb0, rough: 0.85, cls: CLS.cloth }, blueD: { c: 0x1c2f74, rough: 0.9, cls: CLS.cloth },
      trim: { c: 0xd2dcf0, rough: 0.6, cls: CLS.cloth },
      leather: { c: 0x3b3346, rough: 0.6, cls: CLS.leather },
      field: { c: 0x2a44a2, rough: 0.7, metal: 0, cls: CLS.cloth },
      moon: { c: 0xe4eeff, rough: 0.3, emit: 0.9, cls: CLS.glow },
    } : {
      skin: { c: 0x3a4152, rough: 0.55, metal: 0.4, cls: CLS.metal, vary: 0.04 }, lips: { c: 0x3a4152, rough: 0.55, cls: CLS.metal },
      plate: { c: 0xa3b1c8, rough: 0.28, metal: 0.6, cls: CLS.metal, vary: 0.03 },
      plateM: { c: 0x8f9db6, rough: 0.3, metal: 0.6, cls: CLS.metal },
      plateD: { c: 0x677389, rough: 0.35, metal: 1, cls: CLS.metal },
      plateL: { c: 0xbccbe6, rough: 0.22, metal: 1, cls: CLS.metal },
      visor: { c: 0x8ec8ff, rough: 0.4, emit: 1.7, cls: CLS.glow },
      hair: { c: 0xe4e8f2, rough: 0.6, cls: CLS.hair, vary: 0.06 },
      blue: { c: 0x2f4fb0, rough: 0.85, cls: CLS.cloth, vary: 0.05 }, blueD: { c: 0x1c2f74, rough: 0.9, cls: CLS.cloth },
      trim: { c: 0xb8c8ea, rough: 0.6, cls: CLS.cloth },
      leather: { c: 0x3b3346, rough: 0.6, cls: CLS.leather, vary: 0.06 },
      field: { c: 0x2a44a2, rough: 0.45, metal: 0.35, cls: CLS.metal, vary: 0.03 },
      moon: { c: 0xd8e6ff, rough: 0.3, emit: 0.75, cls: CLS.glow },
    });
    body(sc, P, fam, { elf: false });
    const n0 = sc.prims.length;
    const q = P.hand, wr = (region, mat, t) => K.wrap(sc, region, mat, t);
    // ---- plate on the limbs
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s), side = s > 0 ? [0, 0.2] : [-0.2, 0];
      wr(K.RG.seg(lerp(a.S, a.E, 0.35), lerp(a.S, a.E, 0.94), 0.08), "plate", 0.006);
      wr(K.RG.seg(lerp(a.E, a.W, 0.12), lerp(a.E, a.W, 0.97), 0.08), "plateM", 0.0075);
      wr(K.RG.ball(add(a.W, mul(a.dir, 0.036 * q)), 0.05 * q), "plateD", 0.0035);
      wr(K.RG.box(...side, l.K[1] + 0.03, P.hipY + 0.03), "plate", 0.0065);
      wr(K.RG.box(...side, P.ankY + 0.028, l.K[1] - 0.022), "plate", 0.009);
      wr(K.RG.box(...side, -0.03, P.ankY + 0.028), "plateD", 0.0065);
      sc.limb(lerp(a.E, a.W, 0.84), add(a.W, mul(a.dir, 0.008)), 0.035, 0.041, { mat: "plateD", bone: "fore" + n, k: 0.002 });
      sc.add(S.ell(0.031, 0.031, 0.027), { mat: "plate", p: add(a.E, [s * 0.006, 0.004, -0.018]), bone: "fore" + n, k: 0.003 });
      // pointed knee cop
      sc.add(S.ell(0.038, 0.036, 0.026), { mat: "plateL", p: add(l.K, [0, 0.004, 0.037]), bone: "shin" + n, k: 0.003 });
      // pauldron: a big layered dome, a raised rim ridge, riding the chest
      const pc = [s * 0.17, P.shY + 0.002, -0.008], pe = S.ell(0.088, 0.074, 0.094);
      sc.add(S.custom((x, y, z) => Math.max(pe.f(x, y, z), -0.036 - y), [-0.088, -0.036, -0.094, 0.088, 0.074, 0.094]), { mat: "plate", p: pc, bone: "chest", k: 0.003 });
      sc.add(S.custom((x, y, z) => Math.max(Math.abs(pe.f(x, y, z) + 0.004) - 0.006, -0.036 - y, y + 0.02), [-0.1, -0.036, -0.1, 0.1, -0.01, 0.1]), { mat: "plateL", p: pc, bone: "chest", k: 0.002 });
      const d = norm(sub(a.E, a.S)), ref = norm(sub([s, 0, 0], mul(d, s * d[0])));
      sc.add(ringPlate(a.S, d, ref, 0.064, 0.036, 0.066, 0, 1.95, 0.0055, 0.006), { mat: "plateD", bone: "arm" + n, k: 0.002 });
    }
    // ---- torso: breast and back plate, a raised keel, fauld, belt with a silver disc
    sc.add(S.ell(0.124, 0.108, 0.104), { mat: "plate", p: [0, P.chest[0] - 0.004, -0.01], bone: "chest", k: 0.004 });
    sc.add(S.ell(0.013, 0.078, 0.02), { mat: "plateL", p: [0, P.chest[0] - 0.02, 0.078], bone: "chest", k: 0.004 });
    sc.limb([0, 0.588, -0.006], [0, 0.525, -0.006], 0.102, 0.11, { mat: "plate", bone: "spine", k: 0.003, sz: 0.8 });
    sc.limb([0, 0.53, -0.006], [0, 0.458, -0.006], 0.11, 0.12, { mat: "plate", bone: "root", k: 0.003, sz: 0.8 });
    if (!PX) for (const j of [36, 38]) sc.paint(S.box(0.2, 0.004, 0.2), { mat: "plateD", p: [0, row(j), 0], soft: 0.001, only: ["plate"] });
    wr(K.RG.box(-0.16, 0.16, row(42) - 0.006, row(43) + 0.006), "leather", 0.0055);
    sc.add(S.cyl(0.005, 0.024, 0.002), { mat: "plateL", p: [0, (row(42) + row(43)) / 2, 0.09], r: [Math.PI / 2, 0, 0], bone: "root", k: 0.001 });

    // ---- close helm: a rounded skull, a beaked visor ridge down the front, a glowing slit, two tall swept horns
    const hz = -0.008, hrx = 0.088, hrz = 0.094, yTop = 1.0, yBot = 0.775;
    const helmF = (x, y, z) => {
      const u = clamp((y - 0.9) / (yTop - 0.9), 0, 1), k = y > 0.9 ? Math.sqrt(1 - u * u) : 1 + 0.04 * clamp((0.9 - y) / 0.12, 0, 1);
      return Math.max((Math.hypot(x / hrx, (z - hz) / hrz) - k) * hrx, yBot - y, y - yTop);
    };
    sc.add(S.custom(helmF, pad([-hrx * 1.06, yBot, hz - hrz * 1.06, hrx * 1.06, yTop, hz + hrz * 1.06])), { mat: "plate", p: [0, 0, 0], bone: "head", k: 0.002 });
    // beak: a vertical wedge ridge along the front of the face plate, sharpest at the eye line
    const beak = (x, y, z) => {
      const u = clamp((y - 0.79) / 0.16, 0, 1), jut = 0.026 * Math.sin(Math.PI * Math.pow(u, 0.8));
      return Math.max(Math.abs(x) * 1.25 + (z - (hz + hrz - 0.004 + jut)), 0.79 - y, y - 0.95, -z);
    };
    sc.add(S.custom(beak, pad([-0.09, 0.79, 0, 0.09, 0.95, 0.14])), { mat: "plate", p: [0, 0, 0], bone: "head", k: 0.002 });
    const eyeRow = row(70);
    const slitH = PX ? 0.009 : 0.0058;   // a taller glowing slit on the sprite
    const slit = (x, y, z) => Math.max(Math.abs(x) - 0.06, Math.abs(y - eyeRow) - slitH, 0.02 - z);
    sc.add(S.custom((x, y, z) => Math.max(slit(x, y, z), -(helmF(x, y, z) + 0.012)), [-0.07, 0.84, 0, 0.07, 0.9, 0.14]), { op: "sub", mat: "plate", p: [0, 0, 0], bone: "head", k: 0.001 });
    sc.paint(S.custom((x, y, z) => (z < 0.02 ? 1 : Math.max(Math.abs(x) - 0.06, Math.abs(y - eyeRow) - slitH)), [-0.07, 0.84, 0, 0.07, 0.9, 0.14]), { mat: "visor", soft: 0.001 });
    // breaths: a column of short dark slots under the slit on each cheek
    if (!PX) sc.paint(S.custom((x, y, z) => (z < 0.03 || y > 0.855 || y < 0.8 ? 1 : Math.max(Math.abs(Math.abs(x) - 0.04) - 0.0058, Math.abs(((y - 0.8) % 0.025) - 0.0125) - 0.006)), [-0.1, 0.78, 0, 0.1, 0.87, 0.14]),
      { mat: "plateD", soft: 0.001, only: ["plate"] });
    // brow band and a crest ridge over the crown
    if (!PX) sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - row(72)) - 0.0058, -z - 0.03), [-0.1, 0.88, -0.05, 0.1, 0.92, 0.12]), { mat: "plateL", soft: 0.001, only: ["plate"] });
    const comb = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 0.85 + 0.2, yy = 0.9 + (yTop - 0.9) * Math.sin(a); comb.push([0, yy + 0.004, hz + Math.cos(a) * hrz * Math.sqrt(Math.max(0, 1 - ((yy - 0.9) / (yTop - 0.9)) ** 2)) * 1.02, 0.008]); }
    if (!PX) sc.add(S.chain(comb), { mat: "plateL", p: [0, 0, 0], bone: "head", k: 0.002, vdil: 0.5 });
    // horns: from the temples of the helm, rising tall and sweeping back, thin at the tips
    for (const s of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        pts.push([s * (0.062 + 0.02 * Math.sin(u * 2.2)), 0.95 + 0.16 * u + 0.02 * Math.sin(u * 3), hz + 0.03 - 0.075 * u * u, PX ? mix(0.024, 0.01, Math.pow(u, 1.3)) : mix(0.017, 0.003, Math.pow(u, 0.9))]);
      }
      sc.add(S.chain(pts), { mat: "plateL", p: [0, 0, 0], bone: "head", k: 0.004, vdil: 0.55 });
    }

    // ---- hair: a white mane from under the helm's rim down the back, streaming a little to the right
    sc.part = "hair";
    const C = [0, 0.9, hz], R = [hrx, 0.1, hrz];
    // pixel: four big locks instead of nine wavy strands
    const NH = PX ? 5 : 9;
    for (let i = 0; i < NH; i++) {
      const u = (i / (NH - 1)) * 2 - 1, az = Math.PI + u * (PX ? 1.0 : 1.35);
      const root = onEll(C, R, az, -0.5, 0.95);
      const out = onEll(C, R, az, -0.9, 1.25);
      const len = 0.24 + 0.04 * (1 - Math.abs(u)) + 0.02 * Math.sin(i * 2.1);
      const tip = [out[0] * 1.2 - 0.04 - 0.02 * u, P.neck[0] - len, -0.19 - 0.015 * (1 - Math.abs(u))];
      const mid = lerp(out, tip, 0.4); mid[2] -= 0.03;
      const sp = PX ? strand(sc, [root, out, mid, tip], 0.042 - 0.008 * Math.abs(u), 0.016, { k: 0.012, taper: 1.2, bone: "hairB1", grooves: 0 })
        : strand(sc, [root, out, mid, tip], 0.018 - 0.004 * Math.abs(u), 0.004, { wave: 0.008, wd: [1, 0, 0], waves: 2, phase: i * 1.3, k: 0.01, wg: 5, swell: 0.2, bone: "hairB1", grooves: 0.0015 });
      sp.wfn = (x, y) => { const t = sstep(0.84, P.neck[0] - 0.24, y); return [["head", 1 - t], ["hairB1", 2 * t * (1 - t)], ["hairB2", t * t]]; };
    }

    // ---- cloth: a rolled cowl, a short blue tabard, the great cape
    sc.part = "cloth";
    sc.add(S.custom((x, y, z) => Math.hypot(Math.hypot(x, z / 0.92) - 0.064, (y - 0.77) * 1.15) - 0.022, pad([-0.09, 0.74, -0.09, 0.09, 0.8, 0.09])),
      { mat: "blue", p: [0, 0, 0], bone: "chest", k: 0.004, bones: [["chest", 0.7], ["neck", 0.3]] });
    const tab = (x, y, z) => {
      const u = clamp((0.45 - y) / 0.26, 0, 1), w = mix(0.062, 0.07, u), zc = mix(0.1, 0.11, u) + 0.004 * u * Math.sin((x / w) * 4.7 + 0.4);
      return smax(Math.abs(z - zc) - 0.0055, Math.max(Math.abs(x) - w, y - 0.45, 0.19 - y), 0.004);
    };
    const tp = sc.add(S.custom(tab, pad([-0.08, 0.18, 0.08, 0.08, 0.46, 0.12])), { mat: "blue", p: [0, 0, 0], bone: "root", k: 0.003, wg: 1 });
    tp.wfn = (x, y) => { const u = sstep(0.44, 0.25, y), sl = sstep(-0.03, 0.03, x); return [["root", 1 - u * 0.6], ["thighL", u * 0.6 * sl], ["thighR", u * 0.6 * (1 - sl)]]; };
    sc.paint(S.custom((x, y, z) => (z < 0.07 || y > 0.46 ? 1 : Math.max(tab(x, y, z) - 0.004, Math.min(y - 0.21, Math.abs(x) - mix(0.062, 0.07, clamp((0.45 - y) / 0.26, 0, 1)) + 0.011))), [-0.08, 0.18, 0.08, 0.08, 0.46, 0.12]),
      { mat: "trim", soft: 0.001, only: ["blue"] });
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.08, 0.25, Math.pow(u, 0.75));
      return { u, w, zc: mix(capeZ, capeZ - 0.11, u) - (PX ? 0 : 0.02 * Math.sin((x / w) * 5 * 1.57 + 0.5) * (0.25 + u)) + (0.55 - 0.25 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => { const c = capeZc(x, y); return smax(Math.abs(z - c.zc) - 0.0065, Math.max(Math.abs(x) - c.w, y - capeTop, capeBot + (PX ? 0.006 : 0.012 * (1 + Math.sin(x * 30 + 0.6))) - y), 0.006); };
    const cp = sc.add(S.custom(capeF, [-0.33, capeBot, -0.3, 0.33, capeTop, 0.08]), { mat: "blue", p: [0, 0, 0], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > 0.08 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.33, capeBot, -0.3, 0.33, capeTop, 0.08]), { mat: "blueD", soft: 0.001, only: ["blue"] });
    for (const s of [1, -1]) sc.add(S.cyl(0.005, 0.015, 0.002), { mat: "plateL", p: [s * 0.066, capeTop - 0.016, capeZc(s * 0.066, capeTop - 0.016).zc - 0.009], r: [Math.PI / 2, 0, 0], bone: "chest", k: 0.001, part: "cloth" });
    sc.part = "body";

    // ---- tower shield on its own bone (local: x across, y up, z out of the face), grip at G: a tall heater with a flat
    // top, one cube thick, the rim one cube proud; blue field, silver rim, a glowing crescent round a four-point star
    // and a silver spine down the middle to the tip
    const W = 0.15, yT = 0.26, yS = -0.08, yB = -0.46, th = PX ? 0.016 : V / 2, zf = 4.5 * V, bul = PX ? 0.005 : 0.018, rimW = PX ? 0.024 : 0.018;
    const hw = (y) => (y >= yS ? W : W * Math.sqrt(Math.max(0, 1 - Math.pow((yS - y) / (yS - yB), 1.7))));
    const outl = (x, y) => Math.max(Math.abs(x) - hw(y), y - yT, yB - y, (Math.abs(x) + y - (W + yT - 0.03)) * Math.SQRT1_2);
    const zc = (x) => zf - bul * (x / W) ** 2;
    const SB = pad([-W, yB, zf - bul - th, W, yT, zf + 2 * th]);
    if (PX) sc.add(S.custom((x, y, z) => { const o = outl(x, y), rim = o > -rimW ? 0.006 : 0; return Math.max(o, Math.abs(z - zc(x)) - th - rim); }, pad(SB, 0.01)), { mat: "field", p: G, bone: "shield", k: 0.001 });   // rim proud on both faces
    else sc.add(S.custom((x, y, z) => { const o = outl(x, y), rim = o > -rimW ? V / 2 : 0; return Math.max(o, Math.abs(z - zc(x) - rim) - th - rim); }, SB), { mat: "field", p: G, bone: "shield", k: 0.001, vdil: 0.3 });
    const cy = 0.03;
    const emblem = (x, y) => {
      const Y = y - cy, X = Math.abs(x);
      // crescent, horns up: a disc minus a disc shifted up
      const cres = Math.max(Math.hypot(X, Y) - 0.118, -(Math.hypot(X, Y - 0.04) - 0.104));
      // four-point star in the crescent's cup
      const sw = PX ? 0.022 : 0.014, sy = Y - 0.035, star = Math.min(X / sw + Math.abs(sy) / 0.075, X / 0.055 + Math.abs(sy) / sw) * sw - sw;
      return Math.min(cres, star);
    };
    const spine = (x, y) => Math.max(Math.abs(x) - V, y - (cy - 0.11), yB + 0.03 - y);
    const far = (x, y, z) => Math.abs(x) > W + 0.02 || y < yB - 0.02 || y > yT + 0.03 || Math.abs(z - zf) > 0.06;
    sc.paint(S.custom((x, y, z) => { if (far(x, y, z)) return 1; const o = outl(x, y); return PX ? Math.max(o, -(o + rimW)) : Math.min(Math.max(o, -(o + rimW)), Math.max(spine(x, y), zc(x) - V - z)); }, SB), { mat: "plateL", p: G, soft: 0.001, only: ["field"] });
    // pixel: the emblem is raised relief, not paint — a flat painted plate lets the mesh simplifier smear its colour
    if (PX) sc.add(S.custom((x, y, z) => (far(x, y, z) ? 1 : Math.max(emblem(x, y), Math.abs(z - zc(x) - th - 0.004) - 0.006)), SB), { mat: "moon", p: G, bone: "shield", k: 0.001 });
    else sc.paint(S.custom((x, y, z) => (far(x, y, z) ? 1 : Math.max(emblem(x, y), zc(x) - V - z, outl(x, y) + rimW)), SB), { mat: "moon", p: G, soft: 0.001, only: ["field"] });
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.025);
    return { sc, P, kind: "humanoid", props: [] };
  }

  // ------------------------------------------------------------ motion
  let TQ = null;
  const three = () => TQ || (TQ = { T: EmberVesperThree, E: new EmberVesperThree.Euler() });
  /* put the shield on the left fist, facing where the chest faces turned by (tilt, yaw, roll) */
  function carryShield(fig, C, tilt, yaw, roll, free = 0) {
    const { T } = three(), J = fig.J, o = J.shield;
    if (!o) return;
    fig.root.updateMatrixWorld(true);
    const rootQ = fig.root.getWorldQuaternion(new T.Quaternion());
    const chestM = rootQ.clone().invert().multiply(J.chest.getWorldQuaternion(new T.Quaternion())).slerp(new T.Quaternion(), free);
    const want = chestM.multiply(new T.Quaternion().setFromEuler(new T.Euler(tilt, yaw, roll)));
    const P = fig.char.P, a = K.armJoints(P, 1);
    const handM = rootQ.clone().invert().multiply(J.handL.getWorldQuaternion(new T.Quaternion()));
    const fist = C.toM(fig, C.wpos(J.handL)).add(C.V3(...a.dir).applyQuaternion(handM).multiplyScalar(0.044 * P.hand));
    o.position.copy(o.parent.worldToLocal(C.toW(fig, fist)));
    o.quaternion.copy(o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(rootQ.multiply(want)));
  }
  const HIT = 0.42, LEN = 1.2;
  function pose(fig, clip, t, T, C) {
    const V3 = C.V3, J = fig.J, br = Math.sin((T * C.TAU) / 3.4);
    const atk = clip === "attack";
    const r = C.base(fig, atk ? "idle" : clip, atk ? 0 : t, T);
    fig.root.updateMatrixWorld(true);
    // shield carried low in front of the left hip, turned a little out
    let hx = 0.02, hy = -0.27, hz = 0.12, yaw = 0.22, tilt = -0.04, roll = 0.02, free = 0;
    let glow = 0.12 * (0.5 + 0.5 * Math.sin(T * 1.7));
    if (atk) {
      // brace: turn the shield side back, crouch (0-0.3) → bash: drive the shield forward and up, lunge on the left leg
      // (0.3-0.42) → hold with a shudder (→0.62) → recover (→1.1)
      const e = (a, b) => C.sstep(a, b, t);
      const wind = C.bump(0, 0.28, 0.3, 0.4, t), th = C.bump(0.3, HIT, 0.62, 1.05, t);
      const shud = t > HIT ? Math.sin((t - HIT) * 70) * Math.exp(-(t - HIT) * 10) : 0;
      C.addRot(fig, "root", 0.04 * th, 0.4 * wind - 0.28 * th, 0);
      J.root.position.add(V3(0, -0.035 * wind - 0.045 * th, -0.03 * wind + 0.12 * th + 0.004 * shud));
      C.addRot(fig, "spine", -0.05 * wind + 0.1 * th, 0.1 * wind - 0.1 * th, 0);
      C.addRot(fig, "chest", 0.08 * th, 0.15 * wind - 0.15 * th, 0);
      C.addRot(fig, "head", 0.08 * th, -0.3 * wind + 0.2 * th, 0);
      C.rot(fig, "thighL", -0.7 * th - 0.2 * wind, 0, -0.05); C.rot(fig, "shinL", 0.5 * th + 0.3 * wind, 0, 0); C.rot(fig, "footL", 0.2 * th, 0, 0);
      C.rot(fig, "thighR", 0.42 * th + 0.12 * wind, 0, 0.05); C.rot(fig, "shinR", 0.3 * th + 0.25 * wind, 0, 0); C.rot(fig, "footR", -0.28 * th, 0, 0);
      hx += 0.02 * wind + 0.02 * th; hy += 0.05 * wind + 0.14 * th; hz += -0.06 * wind + 0.14 * th + 0.006 * shud;
      yaw += 0.25 * wind - 0.22 * th; tilt += 0.1 * wind + 0.04 * th; free = th;
      // right fist cocked back at the hip
      fig.root.updateMatrixWorld(true);
      const shR = C.toM(fig, C.wpos(J.armR)), k = Math.max(wind, th);
      C.ik(fig, "armR", "foreR", "handR", C.toW(fig, V3(shR.x - 0.05, shR.y - 0.2, shR.z - 0.06)), C.toW(fig, V3(shR.x - 0.3, shR.y - 0.1, shR.z - 0.3)), k);
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.06 + 0.5 * th, 0, 0); C.rot(fig, "cape2" + s, 0.4 * th, 0, 0); }
      C.rot(fig, "hairB1", 0.35 * th, 0, 0); C.rot(fig, "hairB2", 0.2 * th, 0, 0);
      glow += 0.6 * e(0.1, 0.3) * (1 - e(0.45, 0.7)) + 1.4 * C.bump(HIT - 0.03, HIT, 0.5, 0.8, t);
      C.setFace(fig, "fierce");
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * C.sstep(0, 0.05, t);
      hx -= 0.03 * k; hy += 0.08 * k; hz += 0.05 * k; yaw -= 0.2 * k;
    } else if (clip === "victory") {
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      hy += 0.06 * up; hz += 0.04 * up; yaw -= 0.15 * up;
      glow += 0.9 * up;
    }
    fig.root.updateMatrixWorld(true);
    const shL = C.toM(fig, C.wpos(J.armL));
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, V3(shL.x + hx, shL.y + hy + 0.004 * br, shL.z + hz)), C.toW(fig, V3(shL.x + 0.35, shL.y - 0.1, shL.z - 0.3)), 1);
    carryShield(fig, C, tilt, yaw, roll, free);
    C.emitBoost(fig, glow);
    fig.root.updateMatrixWorld(true);
    return atk ? t < LEN : r;
  }

  return {
    cards: ["moonguard"], kind: "humanoid", build, pose, scale: 1.32,
    moves: { attack: { clip: "bash", hit: HIT, length: LEN, style: "blunt" } },
  };
})());
