/* 荒猎神·芬洛斯 — Fenlos, god of the wild hunt (card fenlos): a towering white-furred wolf-god standing upright — a
 * long wolf head with glowing green eyes, tall ears and a crown of bare branching antlers tipped with leaves, a
 * thick ruff, a great mantle of layered green leaves thrown back over the shoulders and streaming to one side, bark
 * vines twisting round the body and limbs, black claws. Rush: he leaps in and rakes with his right claws. */
EmberVoxelKit.define("fenlos", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, smax, add, sub, mul, lerp, norm, cross,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, handFrame, RG, wrap, strand } = K;
  const pad = (b, m = 0.04) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  const tri = (x) => 1 - 2 * Math.abs(x - Math.floor(x) - 0.5);          // triangle wave 0..1..0

  function build(fam) {
    const P = FAM[fam], sc = new Sculpture();
    humanoidBones(sc, P);
    const capeTop = P.shY + 0.006, capeBot = P.kneeY - 0.06, capeZ = -P.chest[3] - 0.03;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    // leaf mantle: lit tops, shaded undersides, 2-voxel mottling — reads as layered leaves
    const leafy = (x, y, z, nx, ny, nz, c) => {
      const k = (ny > 0.5 ? 1.12 : ny < -0.3 ? 0.78 : 1) * (1 + 0.1 * vnoise(Math.floor(x / 0.025), Math.floor(y / 0.025), Math.floor(z / 0.025)));
      c[0] *= k; c[1] *= k; c[2] *= k;
    };
    const barky = (x, y, z, nx, ny, nz, c) => { const g = Math.sin((x + z) * 90 + y * 40 + 2 * vnoise(x * 30, y * 30, z * 30)); const k = g > 0.6 ? 0.75 : 1; c[0] *= k; c[1] *= k; c[2] *= k; };
    mats(sc, {
      skin: { c: 0xcfdbef, rough: 0.85, cls: CLS.fur, vary: 0.04, fur: 0.3 }, lips: { c: 0xcfdbef, rough: 0.85, cls: CLS.fur },
      furS: { c: 0xadb9ca, rough: 0.9, cls: CLS.fur, vary: 0.05, fur: 0.5 },
      mane: { c: 0x93c77e, rough: 0.9, cls: CLS.fur, vary: 0.06, fur: 1 },
      leaf: { c: 0x4c9a3a, rough: 0.75, cls: CLS.plant, vary: 0.06, pattern: leafy },
      leafD: { c: 0x2c5f28, rough: 0.8, cls: CLS.plant, vary: 0.05 },
      leafL: { c: 0x8ccc58, rough: 0.7, cls: CLS.plant, vary: 0.06 },
      bark: { c: 0x7a6446, rough: 0.9, cls: CLS.wood, vary: 0.05, pattern: barky },
      antler: { c: 0x8a7352, rough: 0.8, cls: CLS.wood, vary: 0.05 },
      claw: { c: 0x26221f, rough: 0.4, cls: CLS.leather },
      nose: { c: 0x1d1a1c, rough: 0.35, cls: CLS.skin },
      eye: { c: 0xb4ff86, rough: 0.2, emit: 1.9, cls: CLS.glow },
      rune: { c: 0x9ef07a, rough: 0.4, emit: 1.1, cls: CLS.glow },
    });
    body(sc, P, fam, { elf: false });
    // the human head goes: a wolf's head takes its place
    const hb = sc.boneIndex.get("head");
    sc.prims = sc.prims.filter((p) => p.bone !== hb);
    sc.faces.length = 0;
    const n0 = sc.prims.length;

    // ---- claws: three black hooks off each fist
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), { d, n: nn, z } = handFrame(P, s, a), q = P.hand;
      const at = (u, v, w) => add(a.W, add(mul(d, u * q), add(mul(nn, v * q), mul(z, w * q))));
      for (const w of [-0.009, 0, 0.009]) sc.limb(at(0.05, 0.004, w), at(0.078, -0.006, w * 1.2), 0.0055 * q, 0.0014, { mat: "claw", bone: "hand" + n, k: 0.002, vdil: 0.55 });
    }
    // ---- fur: pale shaded underside of the arms and chest, a ruff round the neck and shoulders
    sc.paint(S.custom((x, y, z) => (y > 0.3 && y < 0.72 ? -z + 0.03 : 1), [-1, -1, -1, 1, 1, 1]), { mat: "furS", soft: 0.004, only: ["skin"] });
    const spiky = (amp, f = 70) => (x, y, z) => amp * Math.pow(Math.abs(vnoise(x * f, y * f * 0.5, z * f)), 0.5);
    sc.add(S.ell(0.125, 0.06, 0.1), { mat: "skin", p: [0, P.neck[0] - 0.012, 0.004], bone: "chest", bones: [["chest", 0.75], ["neck", 0.25]], k: 0.02, disp: spiky(0.012), dispAmp: 0.012 });
    sc.add(S.ell(0.07, 0.08, 0.05), { mat: "skin", p: [0, P.neck[0] - 0.06, 0.05], bone: "chest", k: 0.02, disp: spiky(0.01), dispAmp: 0.01 });
    // ---- bark vines: two bands crossing the torso, bark on the forearms and shins
    for (const s of [1, -1]) {
      const A = [s * P.shX * 0.8, P.shY + 0.01, 0], B0 = [-s * P.pelvis[1] * 0.9, P.pelvis[0], 0];
      const dir = norm(sub(B0, A)), nrm = norm(cross(dir, [0, 0, 1]));
      if (s > 0) wrap(sc, RG.band(A, nrm, 0.034, RG.box(-P.shX - 0.03, P.shX + 0.03, P.pelvis[0] - 0.05, P.shY + 0.06)), "leaf", 0.011);
      else wrap(sc, RG.band(A, nrm, 0.009, RG.box(-P.shX, P.shX, P.pelvis[0] - 0.03, P.shY + 0.03)), "bark", 0.006);
      const a = armJoints(P, s), l = legJoints(P, s);
      wrap(sc, RG.band(lerp(a.E, a.W, 0.5), add(a.dir, [0, 0.6, 0]), 0.012, RG.seg(lerp(a.E, a.W, 0.15), lerp(a.E, a.W, 0.9), 0.07)), "bark", 0.006);
      wrap(sc, RG.band(lerp(l.K, l.A, 0.5), [s * 0.5, 1, 0.3], 0.013, RG.box(s > 0 ? 0 : -0.2, s > 0 ? 0.2 : 0, P.ankY + 0.02, l.K[1] - 0.01)), "bark", 0.006);
      wrap(sc, RG.band(lerp(l.H, l.K, 0.55), [-s * 0.4, 1, -0.3], 0.011, RG.box(s > 0 ? 0 : -0.2, s > 0 ? 0.2 : 0, l.K[1] + 0.02, P.hipY - 0.02)), "bark", 0.006);
    }
    // a glowing leaf rune over the heart
    sc.paint(S.custom((x, y, z) => { if (z < 0.04) return 1; const X = Math.abs(x + 0.03), Y = y - (P.chest[0] + 0.02); return Math.min(X / 0.012 + Math.abs(Y) / 0.028 - 1, Math.max(Math.abs(x + 0.03) - 0.0058, Math.abs(Y + 0.03) - 0.012)) * 0.012; }, [-1, -1, -1, 1, 1, 1]),
      { mat: "rune", soft: 0.001, only: ["skin", "furS"] });

    // ---- wolf head (bone head): skull, long muzzle, black nose, cheek ruff, tall ears, glowing eyes
    const hk = { bone: "head", k: 0.012 };
    const HC = [0, 0.905, -0.005];
    sc.add(S.ell(0.068, 0.066, 0.076), { ...hk, mat: "skin", p: HC, k: 0.02 });
    sc.limb(add(HC, [0, -0.012, 0.035]), add(HC, [0, -0.032, 0.14]), 0.044, 0.027, { ...hk, mat: "skin", k: 0.02, sx: 1.05 });
    sc.limb(add(HC, [0, -0.06, 0.02]), add(HC, [0, -0.058, 0.115]), 0.03, 0.018, { ...hk, mat: "furS", k: 0.014 });
    sc.add(S.ell(0.013, 0.01, 0.01), { ...hk, mat: "nose", p: add(HC, [0, -0.028, 0.168]), k: 0.004 });
    sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - (HC[1] - 0.048)) - 0.003, HC[2] + 0.06 - z, 0.018 - Math.abs(x), Math.abs(x) - 0.034), [-1, -1, -1, 1, 1, 1]), { mat: "nose", soft: 0.001, only: ["skin", "furS"] });
    for (const s of [1, -1]) {
      sc.add(S.ell(0.035, 0.04, 0.04), { ...hk, mat: "skin", p: add(HC, [s * 0.058, -0.04, -0.005]), k: 0.02, disp: spiky(0.01, 90), dispAmp: 0.01 });
      // ears: tall, pointed, set back on the skull, a green tuft inside
      const base = add(HC, [s * 0.042, 0.045, -0.025]), tip = add(base, [s * 0.03, 0.085, -0.025]);
      sc.limb(base, tip, 0.028, 0.003, { ...hk, mat: "skin", k: 0.008, sz: 0.45, vdil: 0.6 });
      sc.limb(add(base, [0, 0.01, 0.01]), add(tip, [-s * 0.006, -0.03, 0.014]), 0.012, 0.002, { ...hk, mat: "mane", k: 0.004, sz: 0.5 });
      // eyes: slanted glowing slits either side of the muzzle root
      sc.paint(S.custom((x, y, z) => Math.max(Math.abs(x - s * 0.036) - 0.009, Math.abs(y - HC[1] - 0.012 + 0.25 * (s * x - 0.036)) - 0.0055, 0.035 - z), [-1, -1, -1, 1, 1, 1]), { mat: "eye", soft: 0.001, only: ["skin"] });
    }
    // green-white mane from the brow back over the skull and down the nape
    for (let i = 0; i < 5; i++) {
      const u = (i / 4) * 2 - 1;
      strand(sc, [add(HC, [u * 0.02, 0.055, 0.05]), add(HC, [u * 0.035, 0.08, -0.03]), add(HC, [u * 0.05, 0.02, -0.1]), [u * 0.06, P.neck[0] - 0.01, -0.09]],
        0.016, 0.004, { mat: "mane", k: 0.008, grooves: 0.0015, bone: "head" }).wfn = (x, y) => { const t = sstep(HC[1], P.neck[0], y); return [["head", 1 - t], ["neck", t * 0.5], ["chest", t * 0.5]]; };
    }
    // antlers: bare branches rising up and out from behind the ears, two tines each, tufts of leaves at the tips
    for (const s of [1, -1]) {
      const beam = [], tips = [];
      for (let i = 0; i <= 18; i++) {
        const u = i / 18;
        beam.push([s * (0.035 + 0.17 * u + 0.03 * Math.sin(u * 5)), HC[1] + 0.05 + 0.22 * u - 0.05 * u * u, HC[2] - 0.035 - 0.05 * u + 0.03 * Math.sin(u * 4), mix(0.014, 0.004, Math.pow(u, 0.9))]);
      }
      sc.add(S.chain(beam), { mat: "antler", bone: "head", k: 0.004, vdil: 0.55 });
      tips.push(beam[18].slice(0, 3));
      for (const [u, dir, len] of [[0.35, [s * 0.15, 1, 0.35], 0.09], [0.65, [-s * 0.35, 1, -0.1], 0.085]]) {
        const B = beam[Math.round(u * 18)], dd = norm(dir), pts = [];
        for (let j = 0; j <= 7; j++) { const v = j / 7; pts.push([B[0] + dd[0] * len * v, B[1] + dd[1] * len * v, B[2] + dd[2] * len * v + 0.01 * v * v, mix(B[3] * 0.9, 0.0035, v)]); }
        sc.add(S.chain(pts), { mat: "antler", bone: "head", k: 0.003, vdil: 0.55 });
        tips.push(pts[7].slice(0, 3));
      }
      for (const tp of tips) sc.add(S.ell(0.022, 0.014, 0.018), { mat: "leafL", p: add(tp, [0, 0.004, 0]), r: [0.3, s * 0.5, s * 0.4], bone: "head", k: 0.006 });
    }

    // ---- cloth: the leaf mantle (a jagged-hemmed capelet over the shoulders) and the long leaf cape streaming right
    sc.part = "cloth";
    const my0 = P.neck[0] + 0.012, my1 = P.shY - 0.07, mh = my0 - my1, mr0 = 0.08, mr1 = P.shX + P.delt * 1.35;
    const mantle = S.custom((x, y, z) => {
      const u = clamp(-y / mh, 0, 1), r = mix(mr0, mr1, Math.pow(u, 0.45)), a = Math.atan2(z, x);
      const rr = Math.hypot(x, z / 0.82) - r - 0.006 * u * Math.sin(a * 11);
      const hem = -y - mh + 0.028 * tri(a * 2.2) - 0.05 * Math.max(0, -x / mr1) * Math.max(0, z / mr1 + 0.3);
      return smax(Math.abs(rr) - 0.0075, Math.max(hem, y), 0.006);
    }, [-mr1 - 0.02, -mh - 0.01, -(mr1 + 0.02) * 0.82, mr1 + 0.02, 0.01, (mr1 + 0.02) * 0.82]);
    sc.add(mantle, { mat: "leaf", p: [0, my0, -0.012], bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    sc.paint(S.custom((x, y, z) => Math.abs(y - (my0 - mh * 0.45)) - 0.006, [-1, -1, -1, 1, 1, 1]), { mat: "leafD", soft: 0.001, only: ["leaf"], part: "cloth" });
    const ch = capeTop - capeBot, capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.11, 0.3, Math.pow(u, 0.7)), xc = -0.16 * u * u;
      return { u, w, xc, zc: mix(capeZ, capeZ - 0.12, u) - 0.02 * Math.sin(((x - xc) / w) * 6 + 0.4) * (0.25 + u) + (0.5 - 0.2 * u) * ((x - xc) ** 2) / w };
    };
    const capeF = (x, y, z) => {
      const c = capeZc(x, y);
      return smax(Math.abs(z - c.zc) - 0.0065, Math.max(Math.abs(x - c.xc) - c.w, y - capeTop, capeBot + 0.05 * tri((x - c.xc) * 14) + 0.03 * (x - c.xc) - y), 0.006);
    };
    const cp = sc.add(S.custom(capeF, [-0.52, capeBot - 0.02, -0.34, 0.32, capeTop, 0.1]), { mat: "leaf", bone: "chest", k: 0.004, cs: 0.03, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > 0.06 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.52, capeBot - 0.02, -0.34, 0.32, capeTop, 0.1]), { mat: "leafD", soft: 0.001, only: ["leaf"], part: "cloth" });
    sc.part = "body";
    for (let i = n0; i < sc.prims.length; i++) sc.prims[i].cs = Math.min(sc.prims[i].cs, 0.03);
    return { sc, P, kind: "humanoid", props: [] };
  }

  // ------------------------------------------------------------------ motion
  const HIT = 0.4, LEN = 1.15;
  const bez = (a, b, c, u) => a.clone().multiplyScalar((1 - u) * (1 - u)).add(b.clone().multiplyScalar(2 * u * (1 - u))).add(c.clone().multiplyScalar(u * u));
  function pose(fig, clip, t, T, C) {
    const V = C.V3, J = fig.J, P = fig.char.P;
    const atk = clip === "attack";
    const r = C.base(fig, atk ? "idle" : clip, atk ? 0 : t, T);
    fig.root.updateMatrixWorld(true);
    const shL = C.toM(fig, C.wpos(J.armL)), shR = C.toM(fig, C.wpos(J.armR));
    // a predator's stance: a slight crouch, claws hanging forward, head low
    C.addRot(fig, "spine", 0.06, 0, 0); C.addRot(fig, "neck", 0.06, 0, 0); C.addRot(fig, "head", -0.1, 0, 0);
    let hL = V(shL.x + 0.03, shL.y - 0.28, shL.z + 0.08), hR = V(shR.x - 0.03, shR.y - 0.28, shR.z + 0.08), kL = 1, kR = clip === "victory" ? 0 : 1;
    let glow = 0.12 * (0.5 + 0.5 * Math.sin(T * 1.9));
    if (atk) {
      // coil: crouch, twist the right shoulder back, claws raised high (0-0.28) → leap and rake down across the body
      // (0.28-0.46, contact 0.4) → land and hold (→0.62) → recover (→1.1)
      const e = (a, b) => C.sstep(a, b, t);
      const wind = C.bump(0, 0.26, 0.28, 0.38, t), sw = C.bump(0.28, HIT, 0.62, 1.05, t);
      const hop = Math.sin(clamp((t - 0.28) / 0.2, 0, 1) * Math.PI);
      C.addRot(fig, "root", 0.08 * sw + 0.1 * wind, -0.45 * wind + 0.4 * sw, 0);
      J.root.position.add(V(0, -0.05 * wind + 0.04 * hop - 0.04 * sw, -0.03 * wind + 0.14 * sw));
      C.addRot(fig, "spine", 0.08 * sw, -0.15 * wind + 0.15 * sw, 0);
      C.addRot(fig, "chest", 0.1 * sw - 0.08 * wind, -0.25 * wind + 0.3 * sw, 0.06 * sw);
      C.addRot(fig, "head", 0.05 * sw, 0.35 * wind - 0.3 * sw, 0);
      C.rot(fig, "thighL", -0.8 * sw - 0.3 * wind, 0, -0.05); C.rot(fig, "shinL", 0.6 * sw + 0.45 * wind, 0, 0); C.rot(fig, "footL", 0.2 * sw, 0, 0);
      C.rot(fig, "thighR", 0.45 * sw + 0.1 * wind, 0, 0.05); C.rot(fig, "shinR", 0.35 * sw + 0.35 * wind, 0, 0); C.rot(fig, "footR", -0.3 * sw, 0, 0);
      fig.root.updateMatrixWorld(true);
      const sR = C.toM(fig, C.wpos(J.armR)), sL = C.toM(fig, C.wpos(J.armL)), reach = (P.upArm + P.foreArm) * 0.95;
      const up = V(sR.x - 0.06, sR.y + 0.2, sR.z - 0.08), mid = V(sR.x + 0.02, sR.y + 0.16, sR.z + reach * 1.1), down = V(sR.x + 0.26, sR.y - 0.24, sR.z + reach * 0.55);
      const u = C.sstep(0.27, 0.47, t);
      let target = t < 0.27 ? hR.clone().lerp(up, e(0.02, 0.24)) : bez(up, mid, down, u);
      target = target.lerp(hR, e(0.62, 1.05));
      hR = target;
      C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hR), C.toW(fig, V(sR.x - 0.35, sR.y - 0.05, sR.z - 0.2)), 1);
      kR = 0;
      // the left arm flung back for balance
      hL = hL.clone().lerp(V(sL.x + 0.12, sL.y - 0.16, sL.z - 0.16), Math.max(wind, sw));
      for (const s of ["L", "R"]) { C.rot(fig, "cape1" + s, 0.08 + 0.28 * sw + 0.08 * hop, 0, 0); C.rot(fig, "cape2" + s, 0.22 * sw, 0, 0); }
      glow += 0.4 * wind + 1.5 * C.bump(HIT - 0.04, HIT, HIT + 0.08, HIT + 0.35, t);
    } else if (clip === "victory") {
      // the base lifts the right arm; he throws his head back in a howl
      const up = C.bump(0, 0.3, 1.2, 1.6, t);
      C.addRot(fig, "neck", -0.35 * up, 0, 0); C.addRot(fig, "head", -0.35 * up, 0, 0);
      glow += 1.2 * up;
    }
    fig.root.updateMatrixWorld(true);
    C.ik(fig, "armL", "foreL", "handL", C.toW(fig, hL), C.toW(fig, V(shL.x + 0.35, shL.y - 0.1, shL.z - 0.2)), kL);
    if (kR > 0) C.ik(fig, "armR", "foreR", "handR", C.toW(fig, hR), C.toW(fig, V(shR.x - 0.35, shR.y - 0.1, shR.z - 0.2)), kR);
    C.emitBoost(fig, glow);
    fig.root.updateMatrixWorld(true);
    return atk ? t < LEN : r;
  }

  const aR0 = armJoints(FAM.chunky, -1), qh = FAM.chunky.hand;
  return {
    cards: ["fenlos"], kind: "humanoid", build, pose, scale: 1.3,
    moves: { attack: { clip: "rake", hit: HIT, length: LEN, style: "slash", trail: { bone: "handR", from: mul(aR0.dir, 0.03), to: mul(aR0.dir, 0.085 * qh) } } },
  };
})());
