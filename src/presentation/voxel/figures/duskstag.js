/* 暮角契鹿 — night-blue spirit stag with crescent antlers and glowing moon marks (card duskstag). */
EmberVoxelKit.define("duskstag", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, lin, vnoise, fbm, clamp, mix, sstep, rotm, rotY2, smax, TAU, add, sub, mul, lerp, norm, cross, X,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, body, handFrame, hand, foot, head,
    RG, wrap, bell, skirt, cape, capeBones, lock, cuff, spline, strand, onEll, chibiHair,
    spearProp, bowProp, quiverProp, QF, quadBones, scaleG } = K;
  function stag(fam) {
    const sc = new Sculpture();
    const PX = K.pixel;                                              // pixel-sprite variant: fat crescent antlers, few mane locks
    const chib = fam === "chibi", chunky = fam === "chunky", anime = fam === "anime";
    const Hs = chib ? 1.8 : chunky ? 1.35 : anime ? 1.2 : 1.15;
    const Ls = chib ? 0.55 : chunky ? 0.8 : anime ? 1.06 : 1;
    const drop = (1 - Ls) * 0.4;
    const B_ = (v) => v - drop;          // body landmarks move down when legs shorten
    const L_ = (v) => v * Ls;            // leg landmarks scale
    const G = {
      root: [0, B_(0.46), -0.15], spine: [0, B_(0.46), -0.03], chest: [0, B_(0.46), 0.09], neck: [0, B_(0.5), 0.16], head: [0, B_(0.665) - (chib ? 0.05 : 0), 0.265], jaw: [0, B_(0.655) - (chib ? 0.05 : 0), 0.305],
      tail: [[0, B_(0.48), -0.21], [0, B_(0.46), -0.25], [0, B_(0.43), -0.28]],
      front: [[0.05, B_(0.47), 0.13], [0.05, L_(0.33), 0.115], [0.048, L_(0.17), 0.13], [0.048, 0.045, 0.14]],
      back: [[0.055, B_(0.46), -0.16], [0.058, L_(0.34), -0.105], [0.052, L_(0.2), -0.215], [0.05, 0.045, -0.2]],
      ear: [0.028 * Hs, B_(0.715) - (chib ? 0.05 : 0), 0.275],
    };
    quadBones(sc, G);
    const hc = add(G.head, [0, 0.03 * Hs, 0.02 * Hs]);
    sc.bone("antlerL", "head", 0.022 * Hs, hc[1] + 0.03 * Hs, hc[2] - 0.01); sc.bone("antlerR", "head", -0.022 * Hs, hc[1] + 0.03 * Hs, hc[2] - 0.01);
    mats(sc, {
      hide: { c: 0x2b3668, rough: 0.75, cls: CLS.fur, vary: 0.07, fur: 0.2 }, hideDark: { c: 0x1b2250, rough: 0.7, cls: CLS.fur, vary: 0.05, fur: 0.1 },
      mane: { c: 0xcfd8f4, rough: 0.85, cls: CLS.fur, vary: 0.05, fur: 1 }, belly: { c: 0x3c4a8c, rough: 0.85, cls: CLS.fur, fur: 0.3 },
      hoof: { c: 0x121730, rough: 0.35, cls: CLS.leather }, nose: { c: 0x151a33, rough: 0.35, cls: CLS.skin },
      antler: { c: 0xe8e6f4, rough: 0.3, metal: 0.35, emit: 0.22, cls: CLS.glow, vary: 0.04 },
      mark: { c: 0xa9d0ff, rough: 0.4, emit: 1.3, cls: CLS.glow }, eye: { c: 0xd6e8ff, rough: 0.2, emit: 1.6, cls: CLS.glow },
    });
    const spiky = anime || chunky;
    const furD = (amp, f = 80) => (x, y, z) => amp * (spiky ? Math.pow(Math.abs(vnoise(x * f, y * f * 0.4, z * f)), 0.55) : 0.5 + 0.5 * fbm(x * f, y * f * 0.4, z * f, 2));
    // body: deep chest, tucked waist, round rump
    sc.add(S.ell(0.072, 0.098, 0.118), { mat: "hide", p: add(G.chest, [0, -0.02, 0.0]), bone: "chest", k: 0.04 });
    sc.add(S.ell(0.06, 0.075, 0.12), { mat: "hide", p: add(G.spine, [0, 0.0, 0]), bone: "spine", k: 0.05, sigma: 0.03 });
    sc.add(S.ell(0.068, 0.082, 0.085), { mat: "hide", p: add(G.root, [0, -0.005, 0]), bone: "root", k: 0.045 });
    sc.paint(S.ell(0.075, 0.035, 0.2), { mat: "belly", p: [0, B_(0.345), -0.02], soft: 0.03 });
    // neck: thick base tapering to the head, pale mane down the throat
    const nk = sc.limb(add(G.chest, [0, 0.03, 0.05]), add(hc, [0, -0.025 * Hs, -0.028 * Hs]), 0.066, 0.042 * Hs, { mat: "hide", bone: "neck", k: 0.045, sz: 0.85 });
    nk.wfn = (x, y) => { const u = sstep(G.chest[1] + 0.03, hc[1], y); return [["chest", 1 - u], ["neck", 1 - Math.abs(u - 0.5) * 2], ["head", Math.max(0, u - 0.6) * 1.5]]; };
    // mane: a streaked fall of pale fur from the jaw down the throat to the chest
    const nMane = PX ? 3 : 7;
    for (let i = 0; i < nMane; i++) {
      const u = i / (nMane - 1), x0 = (u - 0.5) * 0.05;
      const top = add(hc, [x0 * 0.6, -0.035 * Hs, -0.005]), mid = [x0, mix(G.chest[1], hc[1], 0.5), mix(G.chest[2], hc[2], 0.5) + 0.045], bot = [x0 * 1.3, G.chest[1] - 0.05 - 0.02 * Math.sin(u * 3.1), G.chest[2] + 0.1];
      const pts = spline([top, mid, bot], 14).map((p, j) => [p[0], p[1], p[2], (PX ? mix(0.024, 0.009, Math.pow(j / 14, 1.4)) : mix(0.016, 0.004, Math.pow(j / 14, 1.4))) * (1 + 0.4 * Math.sin(Math.PI * j / 14))]);
      const m = sc.add(S.chain(pts), { mat: "mane", p: [0, 0, 0], bone: "neck", k: 0.014, ...(PX ? {} : { disp: furD(0.004, 70), dispAmp: 0.005 }) });
      m.wfn = (x, y) => { const v = sstep(G.chest[1], hc[1], y); return [["chest", 1 - v], ["neck", v]]; };
    }
    // head: slim skull, long muzzle, glowing eyes
    const mzl = chib ? 0.55 : 1;
    sc.add(S.ell(0.034 * Hs, 0.036 * Hs, 0.043 * Hs), { mat: "hide", p: hc, bone: "head", k: 0.02 });
    sc.limb(add(hc, [0, -0.006 * Hs, 0.02 * Hs]), add(hc, [0, -0.03 * Hs, 0.09 * Hs * mzl]), 0.025 * Hs, 0.0145 * Hs, { mat: "hide", bone: "head", k: 0.022 });
    sc.add(S.ell(0.0125 * Hs, 0.0095 * Hs, 0.009 * Hs), { mat: "nose", p: add(hc, [0, -0.03 * Hs, 0.101 * Hs * mzl]), bone: "head", k: 0.008, cs: 0.05 });
    const eS = (chib ? 1.8 : anime ? 1.25 : 1) * (PX ? 1.5 : 1);
    for (const s of [1, -1]) sc.add(S.ell(0.0055 * Hs * eS, 0.0075 * Hs * eS, 0.0105 * Hs * eS), { mat: "eye", p: add(hc, [s * 0.03 * Hs, 0.006 * Hs, 0.022 * Hs]), r: [0, s * 0.45, 0], bone: "head", k: 0.004, cs: 0.05 });
    for (const s of [1, -1]) {
      const n = sideName(s), base = add(hc, [s * 0.027 * Hs, 0.024 * Hs, -0.012 * Hs]), tip = add(base, [s * 0.048 * Hs, 0.028 * Hs, -0.012 * Hs]);
      sc.limb(base, tip, 0.014 * Hs * (PX ? 1.2 : 1), PX ? 0.006 : 0.0028, { mat: "hide", bone: "ear" + n, k: 0.01, sx: PX ? 0.6 : 0.5 });
    }
    // antlers: each a great crescent — out and down from the skull, sweeping up the outside and curling back in over the head — with tines pointing into the curve
    const As = (chib ? 0.8 : chunky ? 1.05 : 1) * (anime ? 1.05 : 1);
    for (const s of [1, -1]) {
      const n = sideName(s), b0 = add(hc, [s * 0.02 * Hs, 0.028 * Hs, -0.008]);
      const cx = 0.062 * As, cy = 0.125 * As, R = 0.135 * As, beam = [];
      for (let i = 0; i <= 26; i++) {
        const u = i / 26, th = -2.0 + u * 3.45;
        beam.push([b0[0] + s * (cx + R * Math.cos(th)), b0[1] + cy + R * Math.sin(th), b0[2] - 0.04 * As * Math.sin(u * Math.PI) - 0.015 * u * As, (PX ? mix(0.02, 0.011, Math.pow(u, 1.25)) : mix(0.01, 0.0022, Math.pow(u, 1.25))) * (chib ? 1.5 : 1)]);
      }
      sc.add(S.chain(beam), { mat: "antler", p: [0, 0, 0], bone: "antler" + n, k: 0.004, cs: 0.03 });
      const ctr = [b0[0] + s * cx, b0[1] + cy, b0[2] - 0.02 * As];
      for (const [u, len] of PX ? [[0.4, 0.075], [0.66, 0.085]] : [[0.32, 0.07], [0.48, 0.09], [0.64, 0.095], [0.8, 0.075]]) {
        const Bp = beam[Math.round(u * 26)], toC = norm(sub(ctr, Bp.slice(0, 3))), dir = norm(add(mul(toC, 0.55), [0, 1, 0])), pts = [];
        for (let j = 0; j <= 8; j++) {
          const v = j / 8;
          pts.push([Bp[0] + dir[0] * len * v * As, Bp[1] + dir[1] * len * v * As, Bp[2] + dir[2] * len * v * As + 0.015 * v * v * As, mix(Bp[3] * 0.95, PX ? 0.008 : 0.0016, Math.pow(v, 0.8))]);
        }
        sc.add(S.chain(pts), { mat: "antler", p: [0, 0, 0], bone: "antler" + n, k: 0.0035, cs: 0.03 });
      }
    }
    // legs: muscular tops, slender cannons, small hooves
    for (const s of [1, -1]) {
      const n = sideName(s), F = G.front.map((p) => X(p, s)), B = G.back.map((p) => X(p, s));
      sc.add(S.ell(0.036, 0.075, 0.05), { mat: "hide", p: add(F[0], [0, -0.04, -0.004]), bone: "scap" + n, bones: [["scap" + n, 0.7], ["chest", 0.3]], k: 0.035 });
      sc.limb(F[0], F[1], 0.03, 0.018, { mat: "hide", bone: "scap" + n, k: 0.025 });
      const lk = PX ? 1.35 : 1;
      sc.limb(F[1], F[2], 0.0155 * lk, 0.011 * lk, { mat: "hideDark", bone: "elb" + n, k: 0.012 });
      sc.limb(F[2], F[3], 0.0105 * lk, 0.009 * lk, { mat: "hideDark", bone: "wri" + n, k: 0.008 });
      sc.limb(add(F[3], [0, -0.01, -0.002]), add(F[3], [0, -0.042, 0.012]), 0.0095 * lk, 0.0135 * lk, { mat: "hoof", bone: "fpaw" + n, k: 0.004, cs: 0.03 });
      sc.add(S.ell(0.048, 0.085, 0.058), { mat: "hide", p: add(B[0], [0, -0.045, 0.012]), bone: "hip" + n, bones: [["hip" + n, 0.7], ["root", 0.3]], k: 0.035 });
      sc.limb(B[1], B[2], 0.021, 0.0115 * lk, { mat: "hide", bone: "stif" + n, k: 0.016 });
      sc.limb(B[2], B[3], 0.0105 * lk, 0.009 * lk, { mat: "hideDark", bone: "hock" + n, k: 0.008 });
      sc.limb(add(B[3], [0, -0.01, -0.002]), add(B[3], [0, -0.042, 0.012]), 0.0095 * lk, 0.0135 * lk, { mat: "hoof", bone: "bpaw" + n, k: 0.004, cs: 0.03 });
      // glowing crescent marks, projected sideways onto shoulder and haunch
      const crescent = (c, r, rot) => sc.paint(S.custom((x, y, z) => {
        const cy = Math.cos(rot), sy = Math.sin(rot), Y = y * cy - z * sy, Z = y * sy + z * cy;
        const a = Math.hypot(Y, Z) - r, b = Math.hypot(Y - r * 0.42, Z - r * 0.1) - r * 0.82;
        return Math.max(a, -b, -x * s);
      }, [-1, -1, -1, 1, 1, 1]), { mat: "mark", p: c, soft: 0.0025 });
      crescent([s * 0.02, G.chest[1] + 0.005, G.chest[2] - 0.005], 0.034, 0.5);
      crescent([s * 0.02, G.root[1] + 0.0, G.root[2] + 0.02], 0.03, -0.9);
    }
    // wispy pale tail
    const T0 = G.tail[0], tp = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; tp.push([0, T0[1] - 0.05 * u - 0.03 * u * u, T0[2] - 0.08 * u, mix(0.02, 0.006, u) * (PX ? 1.3 : 1)]); }
    const tail = sc.add(S.chain(tp), { mat: "mane", p: [0, 0, 0], bone: "tail1", k: 0.015, ...(PX ? {} : { disp: furD(0.007, 70), dispAmp: 0.008 }) });
    tail.wfn = (x, y, z) => { const u = clamp((T0[2] - z) / 0.08, 0, 1); return [["root", 1 - sstep(0, 0.2, u)], ["tail1", Math.max(0, 1 - Math.abs(u - 0.25) * 2.5)], ["tail2", Math.max(0, 1 - Math.abs(u - 0.6) * 2.8)], ["tail3", sstep(0.6, 0.95, u)]]; };
    sc.faceKind = "stag";
    return { sc, kind: "quadruped", props: [], G, Hs };
  }

  return {
    cards: ["duskstag"], kind: "quadruped", build: stag, scale: 1.05,
    moves: { attack: { clip: "gore", style: "blunt" } },
  };
})());
