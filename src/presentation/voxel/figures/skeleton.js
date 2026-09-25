/* 骸骨 — Skeleton (card skeleton): a bony spearman — big skull with ember-red eyes glowing in dark sockets, open
 * ribcage, a torn dark-crimson mantle and cape hanging off the left shoulder, a ragged loincloth on a belt, iron
 * cuffs at wrists and ankles, a long dark spear. Thin bones on the chunky landmarks (same bone names as every
 * humanoid, plus a jaw that chatters, and gapes at the thrust). */
EmberVoxelKit.define("skeleton", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, clamp, mix, sstep, smax, add, sub, mul, lerp, norm, cross,
    FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones, hand } = K;
  const V = 0.0125;
  const row = (j) => (j + 0.5) * V;
  /* generous bounds: the voxelizer skips a whole 8³ block when the prims listed at the block's centre are all
   * subtractive or far away, so thin or carved parts pad their bounds to reach the neighbouring block centres */
  const pad = (b, m = 0.05) => [b[0] - m, b[1] - m, b[2] - m, b[3] + m, b[4] + m, b[5] + m];
  const padded = (sh, m = 0.05) => S.custom(sh.f, pad(sh.b, m));
  const hash = (k) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  // torn hem: triangular teeth of random depth (0..1)
  const tear = (u) => { const k = Math.floor(u), f = u - k; return (1 - Math.abs(2 * f - 1)) * (0.35 + 0.65 * hash(k)); };
  // pixel sprite: a few big regular teeth instead (same average depth, a third of the frequency)
  const tearPx = (u) => { const f = u / 3 - Math.floor(u / 3); return 1 - Math.abs(2 * f - 1); };

  // ------------------------------------------------------------ prop
  function boneSpear() {
    const sc = new Sculpture(), PX = EmberVoxelKit.pixel;
    sc.bone("p", null, 0, 0, 0);
    mats(sc, {
      shaft: { c: 0x2f2520, rough: 0.75, cls: CLS.wood, vary: 0.1 }, wrap: { c: 0x4a2a22, rough: 0.8, cls: CLS.leather },
      iron: { c: 0x8a93a0, rough: 0.35, metal: 1, cls: CLS.metal, vary: 0.05 }, ironD: { c: 0x4a4e57, rough: 0.5, metal: 0.8, cls: CLS.metal },
      rust: { c: 0x7a4428, rough: 0.8, cls: CLS.leather },
    });
    const R = PX ? 0.012 : 0.0095, top = 0.5, bot = -0.44;
    sc.limb([0, bot, 0], [0, top, 0], R, R * 0.85, { mat: "shaft", bone: "p", k: 0.002 });
    if (PX) {
      // pixel: one grip wrap, a plain socket and a broad, thick leaf blade; no rust speckle
      sc.add(S.cyl(0.03, R * 1.35, 0.003), { mat: "wrap", p: [0, 0, 0], bone: "p", k: 0.002 });
      sc.limb([0, top - 0.05, 0], [0, top + 0.02, 0], R * 1.2, R * 1.5, { mat: "ironD", bone: "p", k: 0.002 });
      const bl = 0.17, bw = 0.027;
      sc.add(S.custom((x, y, z) => {
        const u = clamp(y / bl, 0, 1), w = bw * Math.sin(Math.PI * Math.pow(u, 0.55)) * (1 - 0.3 * u) + 0.004;
        return Math.max(Math.abs(x) - w, Math.abs(z) - (0.011 * (1 - 0.5 * u) + 0.004), -y, y - bl);
      }, [-bw - 0.004, 0, -0.016, bw + 0.004, bl, 0.016]), { mat: "iron", p: [0, top + 0.015, 0], bone: "p", k: 0.001 });
      return sc;
    }
    for (const y of [-0.03, 0.03, 0.34]) sc.add(S.cyl(0.012, R * 1.35, 0.003), { mat: "wrap", p: [0, y, 0], bone: "p", k: 0.002 });
    // socket with a ring collar
    sc.limb([0, top - 0.05, 0], [0, top + 0.02, 0], R * 1.1, R * 1.35, { mat: "ironD", bone: "p", k: 0.002 });
    sc.add(S.cyl(0.006, R * 1.9, 0.002), { mat: "ironD", p: [0, top - 0.035, 0], bone: "p", k: 0.001 });
    // narrow leaf blade
    const bl = 0.17, bw = 0.02, y0 = top + 0.015;
    const blade = S.custom((x, y, z) => {
      const u = clamp(y / bl, 0, 1), w = bw * Math.sin(Math.PI * Math.pow(u, 0.55)) * (1 - 0.3 * u) + 0.0015;
      const dz = Math.abs(z) - (0.0055 * (1 - u) + 0.0012) * (1 - 0.6 * Math.min(1, Math.abs(x) / w));
      return Math.max((Math.abs(x) - w) * 0.8, dz, -y, y - bl);
    }, [-bw - 0.002, 0, -0.008, bw + 0.002, bl, 0.008]);
    sc.add(blade, { mat: "iron", p: [0, y0, 0], bone: "p", k: 0.001 });
    // rust bloom along the lower blade
    sc.paint(S.custom((x, y, z) => { const u = (y - y0) / bl; return u < 0 || u > 0.4 ? 1 : 0.5 + 0.5 * Math.sin(x * 900 + y * 310) - 0.55 - 0.6 * (0.4 - u); }, [-0.03, y0, -0.01, 0.03, y0 + bl, 0.01]),
      { mat: "rust", p: [0, 0, 0], soft: 0.0005, only: ["iron"] });
    return sc;
  }
  const SPEAR_TIP = 0.5 + 0.015 + 0.17;

  // ------------------------------------------------------------ figure
  function build(fam) {
    const P = FAM[fam], sc = new Sculpture(), PX = K.pixel;   // PX: pixel sprite — fatter bones, regular teeth, no noise
    const tr = PX ? tearPx : tear, wv = PX ? 0 : 1;             // torn edges; wavy-fold amplitude
    humanoidBones(sc, P);
    const capeTop = 0.752, capeBot = 0.26, capeZ = -0.078;
    K.capeBones(sc, P, capeTop, capeBot, capeZ);
    sc.bone("jaw", "head", 0, 0.842, -0.012);
    mats(sc, {
      // blue-grey albedo: under the golden-hour key and the warm highlight grade it lands on pale ivory, shadows stay cool
      bone: { c: 0xb9bec0, rough: 0.6, cls: CLS.skin, vary: 0.04 }, boneD: { c: 0x767b82, rough: 0.7, cls: CLS.skin },
      socket: { c: 0x1a0d0e, rough: 0.9, cls: CLS.cloth },
      eyeGlow: { c: 0xb81008, cls: CLS.glow, emit: 0.55, rough: 0.4 }, emberD: { c: 0x5a0d0b, cls: CLS.glow, emit: 0.55, rough: 0.8 },
      cloak: { c: 0x86202f, rough: 0.9, cls: CLS.cloth, vary: 0.06 }, cloakD: { c: 0x4c1019, rough: 0.9, cls: CLS.cloth },
      rag: { c: 0x5e4352, rough: 0.9, cls: CLS.cloth, vary: 0.06 }, ragD: { c: 0x3a2833, rough: 0.9, cls: CLS.cloth },
      leather: { c: 0x6a4430, rough: 0.65, cls: CLS.leather, vary: 0.08 },
      iron: { c: 0x5a5f6a, rough: 0.45, metal: 0.8, cls: CLS.metal, vary: 0.04 }, ironD: { c: 0x3a3c44, rough: 0.5, metal: 0.7, cls: CLS.metal },
    });
    const B = { mat: "bone" }, thin = { ...B, vdil: 0.55 }, bw = PX ? 1.4 : 1;   // bw: long-bone radius scale
    // ---- skull: round cranium, flat face, cheekbones, upper teeth; jaw on its own bone
    sc.add(padded(S.ell(0.074, 0.078, 0.084)), { ...B, p: [0, 0.918, -0.016], bone: "head", k: 0.012 });
    sc.add(padded(S.box(0.056, 0.042, 0.03, 0.018)), { ...B, p: [0, 0.866, 0.042], bone: "head", k: 0.012 });
    for (const s of [1, -1]) sc.add(S.ell(0.014, 0.012, 0.022), { ...B, p: [s * 0.057, 0.856, 0.038], bone: "head", k: 0.006 });
    sc.add(padded(S.box(0.037, 0.011, 0.022, 0.006)), { ...B, p: [0, 66 * V, 0.05], bone: "head", k: 0.004 });  // upper teeth: rows 65-66
    sc.add(padded(S.box(0.038, 0.011, 0.026, 0.007)), { ...B, p: [0, 64 * V, 0.044], bone: "jaw", k: 0.002 });   // jaw: rows 63-64
    for (const s of [1, -1]) sc.limb([s * 0.04, 0.8, 0.028], [s * 0.05, 0.846, -0.012], 0.009, 0.008, { ...B, bone: "jaw", k: 0.002 });
    // sockets (three cubes square, two deep), nose (two by two) and a mouth line: carved on the lattice, painted dark
    const sock = (x, y) => Math.max(Math.abs(Math.abs(x) - 2.5 * V) - 1.5 * V, Math.abs(y - row(70)) - 1.5 * V);
    const nose = (x, y) => Math.max(Math.abs(x) - V, Math.abs(y - (row(67) + row(68)) / 2) - V);
    sc.add(S.custom((x, y, z) => Math.max(Math.min(sock(x, y), nose(x, y)), 0.05 - z + (nose(x, y) < 0 ? 0.0125 : 0)), [-0.07, 0.83, 0.03, 0.07, 0.91, 0.12]),
      { op: "sub", mat: "bone", p: [0, 0, 0], bone: "head", k: 0.001 });
    sc.paint(S.custom((x, y, z) => (z < 0.02 || y < 0.82 || y > 0.91 ? 1 : Math.min(sock(x, y), nose(x, y)) - 0.001), [-0.07, 0.83, 0.02, 0.07, 0.91, 0.12]), { mat: "socket", p: [0, 0, 0], soft: 0.001, only: ["bone"] });
    /* ember eyes: one glowing cube floating in each socket, a dim red rim on the socket floor. The field is scaled up
     * (same one-cube footprint) so the eye outvotes the un-carved skull for its colour: the voxel colour pass tracks
     * carved pockets as if they were still solid */
    const ember = S.custom((x, y, z) => (Math.hypot(x, y, z) - 0.0035) * 6, [-0.004, -0.004, -0.004, 0.004, 0.004, 0.004]);
    for (const s of [1, -1]) sc.add(ember, { mat: "eyeGlow", p: [s * 2.5 * V, row(70), 0.0563], bone: "head", k: 0.001, cs: 0.01, vdil: 0.6, s: PX ? 2 : 1 });
    sc.paint(S.custom((x, y, z) => (z < 0.02 || y > 0.87 ? 1 : Math.max(Math.abs(Math.abs(x) - 2.5 * V) - 1.5 * V, Math.abs(y - row(69)) - 0.5 * V)), [-0.07, 0.83, 0.02, 0.07, 0.91, 0.12]), { mat: "emberD", p: [0, 0, 0], soft: 0.001, only: ["bone"] });
    // pixel: the socket floor itself glows (two by two), so both eyes read at sprite size
    if (PX) sc.paint(S.custom((x, y, z) => (z < 0.02 || y < 0.84 || y > 0.9 ? 1 : Math.max(Math.abs(Math.abs(x) - 2.5 * V) - V, Math.abs(y - row(70)) - V)), [-0.07, 0.83, 0.02, 0.07, 0.91, 0.12]), { mat: "eyeGlow", p: [0, 0, 0], soft: 0.001, only: ["bone"] });
    // teeth: every other column dark on the two tooth rows, dark row between the jaws
    if (!PX) sc.paint(S.custom((x, y, z) => {
      if (z < 0.035 || y < row(63) || y > row(66)) return 1;
      const col = Math.floor(Math.abs(x) / V);
      const toothRow = Math.abs(y - row(64)) < V / 2 || Math.abs(y - row(65)) < V / 2;
      return toothRow && Math.abs(x) < 3 * V && col === 1 ? -1 : 1;
    }, [-0.05, 0.78, 0.03, 0.05, 0.85, 0.1]), { mat: "socket", p: [0, 0, 0], soft: 0.001, only: ["bone"] });
    // ---- neck, spine, ribcage, clavicles, scapulae, pelvis
    sc.limb([0, 0.738, -0.03], [0, 0.842, -0.012], 0.011 * bw, 0.01 * bw, { ...B, bone: "neck", k: 0.004, vdil: 0.5 });
    if (!PX) for (const y of [0.77, 0.795, 0.82]) sc.add(S.ell(0.017, 0.006, 0.014), { ...B, p: [0, y, -0.022], bone: "neck", k: 0.002 });
    sc.limb([0, 0.585, -0.04], [0, 0.745, -0.042], 0.012, 0.011, { ...B, bone: "chest", k: 0.004 });
    if (!PX) for (const y of [0.61, 0.645, 0.68, 0.715]) sc.add(S.box(0.005, 0.006, 0.011), { mat: "boneD", p: [0, y, -0.055], bone: "chest", k: 0.002 });
    sc.limb([0, 0.742, 0.05], [0, 0.63, 0.058], 0.009, 0.0075, { ...B, bone: "chest", k: 0.003, vdil: 0.5 });
    // ribs: one-row bands on the lattice, three rows apart, each stepping down a row toward the front; the last floats
    const RIB = [[58, 0.068, 0.047], [55, 0.08, 0.053], [52, 0.085, 0.055], [49, 0.079, 0.051]];
    RIB.forEach(([j, rx, rz], i) => {
      const ring = S.custom((x, y, z) => {
        const yr = z > 0.012 + 0.25 * rz ? row(j - 1) : row(j), open = i === 3 && z > 0 ? 0.034 - Math.abs(x) : -1;
        return Math.max(Math.abs(y - yr) - 0.45 * V, Math.abs(Math.hypot(x / rx, (z - 0.008) / rz) - 1) * rz - 0.0052, open);
      }, pad([-rx - 0.01, row(j - 1) - V, 0.008 - rz - 0.01, rx + 0.01, row(j) + V, 0.008 + rz + 0.01], 0.03));
      sc.add(ring, { ...B, p: [0, 0, 0], bone: "chest", k: 0.002, vdil: 0.25 });
    });
    for (const s of [1, -1]) {
      sc.limb([s * 0.012, 0.742, 0.05], [s * 0.118, 0.756, -0.002], 0.006, 0.0055, { ...B, bone: "chest", k: 0.002, vdil: 0.5 });
      sc.add(S.ell(0.034, 0.042, 0.007), { mat: "boneD", p: [s * 0.058, 0.705, -0.058], r: [0.15, -s * 0.35, s * 0.2], bone: "chest", k: 0.003 });
    }
    sc.limb([0, 0.498, -0.034], [0, 0.6, -0.036], 0.012, 0.012, { ...B, bone: "spine", k: 0.004 });
    if (!PX) for (const y of [0.53, 0.555, 0.58]) sc.add(S.ell(0.019, 0.008, 0.017), { ...B, p: [0, y, -0.03], bone: "spine", k: 0.002 });
    for (const s of [1, -1]) sc.add(S.ell(0.04, 0.024, 0.014), { ...B, p: [s * 0.054, 0.5, -0.014], r: [0, -s * 0.5, s * 0.3], bone: "root", k: 0.004 });
    sc.add(S.ell(0.024, 0.036, 0.016), { ...B, p: [0, 0.498, -0.036], bone: "root", k: 0.004 });
    sc.limb([-0.045, 0.462, 0.012], [0.045, 0.462, 0.012], 0.0085, 0.0085, { ...B, bone: "root", k: 0.003 });
    // ---- limbs: knobbed long bones, bony fists, iron cuffs
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s), l = legJoints(P, s);
      sc.add(S.sphere(0.018), { ...B, p: add(a.S, [s * 0.004, 0, 0]), bone: "arm" + n, k: 0.002 });
      sc.limb(a.S, a.E, 0.0095 * bw, 0.008 * bw, { ...thin, bone: "arm" + n, k: 0.003 });
      sc.add(S.ell(0.016, 0.015, 0.014), { ...B, p: a.E, bone: "fore" + n, k: 0.003 });
      sc.limb(a.E, a.W, 0.0085 * bw, 0.0075 * bw, { ...thin, bone: "fore" + n, k: 0.003 });
      hand(sc, P, s, a, "bone");
      sc.add(S.cyl(0.014, 0.0185, 0.003), { mat: "iron", p: lerp(a.E, a.W, 0.8), R: K.rotY2(...a.dir), bone: "fore" + n, k: 0.002 });
      if (!PX) sc.add(S.cyl(0.004, 0.02, 0.002), { mat: "leather", p: lerp(a.E, a.W, 0.8), R: K.rotY2(...a.dir), bone: "fore" + n, k: 0.001 });
      sc.add(S.sphere(0.017), { ...B, p: add(l.H, [s * 0.006, 0.004, 0]), bone: "thigh" + n, k: 0.002 });
      sc.limb(l.H, l.K, 0.0115 * bw, 0.0095 * bw, { ...thin, bone: "thigh" + n, k: 0.003 });
      sc.add(S.ell(0.02, 0.015, 0.017), { ...B, p: add(l.K, [0, 0.008, -0.004]), bone: "thigh" + n, k: 0.003 });
      sc.add(S.ell(0.011, 0.013, 0.007), { ...B, p: add(l.K, [0, 0.004, 0.016]), bone: "shin" + n, k: 0.002 });
      sc.limb(l.K, l.A, 0.0105 * bw, 0.008 * bw, { ...thin, bone: "shin" + n, k: 0.003 });
      sc.add(S.cyl(0.015, 0.021, 0.003), { mat: "iron", p: add(l.A, [0, 0.022, 0]), bone: "shin" + n, k: 0.002 });
      if (!PX) sc.add(S.cyl(0.0035, 0.0225, 0.002), { mat: "ironD", p: add(l.A, [0, 0.03, 0]), bone: "shin" + n, k: 0.001 });
      // foot: heel, bony arch, toes
      sc.add(S.ell(0.017, 0.016, 0.02), { ...B, p: [l.A[0], 0.022, l.A[2] - 0.012], bone: "foot" + n, k: 0.006 });
      sc.add(S.ell(0.025, 0.011, 0.046), { ...B, p: [l.A[0], 0.014, l.A[2] + 0.04], bone: "foot" + n, k: 0.008 });
    }
    // ---- belt over the hips with a round iron buckle
    sc.add(S.custom((x, y, z) => Math.max(Math.abs(Math.hypot(x / 0.09, (z + 0.012) / 0.066) - 1) * 0.066 - 0.006, Math.abs(y - 0.5) - V), pad([-0.09, 0.48, -0.08, 0.09, 0.52, 0.06], 0.03)),
      { mat: "leather", p: [0, 0, 0], bone: "root", k: 0.002 });
    if (!PX) sc.add(S.cyl(0.004, 0.014, 0.002), { mat: "iron", p: [0.012, 0.5, 0.054], r: [Math.PI / 2, 0, 0], bone: "root", k: 0.001 });
    // ---- cloth: torn mantle (low over the left shoulder), torn cape, ragged loincloth
    sc.part = "cloth";
    // bunched collar round the neck
    sc.add(S.custom((x, y, z) => Math.hypot(Math.hypot(x, (z + 0.012) / 0.9) - 0.054 - 0.004 * wv * Math.sin(Math.atan2(x, z) * 5), (y - 0.764) * 1.25) - 0.019, pad([-0.08, 0.74, -0.09, 0.08, 0.79, 0.07])),
      { mat: "cloak", p: [0, 0, 0], bone: "chest", k: 0.004, bones: [["chest", 0.7], ["neck", 0.3]] });
    // drape over the left shoulder: an arch over the shoulder knob with a short torn front fall, the back fall joins
    // the cape; kept clear of the ribcage
    const dF = 0.046, dB = -0.062, dC = (dF + dB) / 2, dR = (dF - dB) / 2;
    const drape = (x, y, z) => {
      const dY = 0.73 - 0.012 * clamp((x - 0.08) / 0.08, 0, 1), fold = 0.006 * wv * Math.sin(x * 80 + 0.5) * sstep(dY, dY - 0.05, y);
      const zf = dF + 0.25 * Math.max(0, dY - y) + fold, zb = dB - fold;
      const d = y > dY ? Math.abs(Math.hypot(z - dC, y - dY) - dR) : Math.min(Math.abs(z - zf), Math.abs(z - zb));
      const hem = z > dC ? 0.7 - 0.05 * sstep(0.1, 0.17, x) + 0.03 * tr(x * 34 + 2) : 0.6;
      return Math.max(d - 0.0065, hem - y, 0.078 + 0.016 * wv * tear(y * 40 + 3) - x, x - 0.172 - 0.012 * wv * tear(y * 45 + 1));
    };
    const mp = sc.add(S.custom(drape, pad([0.04, 0.57, -0.09, 0.2, 0.81, 0.1])), { mat: "cloak", p: [0, 0, 0], bone: "chest", k: 0.004, wg: 2 });
    mp.wfn = (x, y) => { const k = 0.65 * sstep(0.11, 0.16, x) * sstep(0.74, 0.66, y); return [["chest", 1 - k], ["armL", k]]; };
    const ch = capeTop - capeBot;
    const capeZc = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), w = mix(0.09, 0.2, Math.pow(u, 0.8));
      return { u, w, zc: mix(capeZ, capeZ - 0.075, u) - (PX ? 0.006 : 0.014) * Math.sin((x / w) * (PX ? 2 : 5) * 1.57 + 0.9) * (0.25 + u) + (x > 0 ? 0.85 - 0.25 * u : 0.5 - 0.25 * u) * (x * x) / w };
    };
    const capeF = (x, y, z) => {
      const c = capeZc(x, y), hem = capeBot + 0.05 * sstep(0.15, -0.15, x) + 0.075 * tr(x * 26 + 3);
      // a couple of rents in the cloth
      const rent = Math.min(Math.hypot((x - 0.05) / 0.012, (y - 0.4) / 0.05), Math.hypot((x + 0.08) / 0.01, (y - 0.47) / 0.04)) - 1;
      return smax(Math.abs(z - c.zc) - (PX ? 0.0075 : 0.006), Math.max(Math.abs(x) - c.w, y - capeTop, hem - y, PX ? -1 : -rent * 0.01), 0.005);
    };
    const cp = sc.add(S.custom(capeF, pad([-0.24, capeBot, -0.2, 0.24, capeTop, 0.05])), { mat: "cloak", p: [0, 0, 0], bone: "chest", k: 0.004, wg: 2 });
    cp.wfn = (x, y) => {
      const u = clamp((capeTop - y) / ch, 0, 1), sl = sstep(-0.05, 0.05, x);
      const top = 1 - sstep(0, 0.3, u), mid = sstep(0, 0.3, u) * (1 - sstep(0.4, 0.8, u)), low = sstep(0.4, 0.8, u);
      return [["chest", top], ["cape1L", mid * sl], ["cape1R", mid * (1 - sl)], ["cape2L", low * sl], ["cape2R", low * (1 - sl)]];
    };
    sc.paint(S.custom((x, y, z) => (z > 0.04 || y > capeTop + 0.01 ? 1 : capeZc(x, y).zc - z + 0.001), [-0.24, capeBot, -0.2, 0.24, capeTop, 0.05]), { mat: "cloakD", p: [0, 0, 0], soft: 0.001, only: ["cloak"] });
    // loincloth: front and back flaps with torn hems
    const flap = (zf, dz, yb, seed) => (x, y, z) => {
      const u = clamp((0.505 - y) / (0.505 - yb), 0, 1), w = mix(0.056, 0.07, u), zc = zf + dz * u + 0.004 * wv * u * Math.sin(x * 60 + seed);
      const hem = yb + 0.045 * tr(x * 32 + seed);
      return smax(Math.abs(z - zc) - 0.0055, Math.max(Math.abs(x) - w, y - 0.505, hem - y), 0.004);
    };
    for (const [zf, dz, yb, seed] of [[0.048, 0.012, 0.325, 1], [-0.06, -0.014, 0.31, 7]]) {
      const lp = sc.add(S.custom(flap(zf, dz, yb, seed), pad([-0.08, yb, Math.min(zf, zf + dz) - 0.01, 0.08, 0.505, Math.max(zf, zf + dz) + 0.01])), { mat: "rag", p: [0, 0, 0], bone: "root", k: 0.003, wg: 1 });
      lp.wfn = (x, y) => { const u = sstep(0.49, 0.36, y), sl = sstep(-0.04, 0.04, x); return [["root", 1 - u * 0.6], ["thighL", 0.6 * u * sl], ["thighR", 0.6 * u * (1 - sl)]]; };
    }
    sc.paint(S.custom((x, y, z) => (Math.abs(z) < 0.03 || y > 0.46 ? 1 : y - 0.34 - 0.03 * tr(x * 32 + 4)), [-0.08, 0.3, -0.08, 0.08, 0.5, 0.08]), { mat: "ragD", p: [0, 0, 0], soft: 0.001, only: ["rag"] });
    sc.part = "body";
    return {
      sc, P, kind: "humanoid",
      props: [{ sc: boneSpear(), bone: "handR", at: armJoints(P, -1).W, grip: "spear" }],
    };
  }

  // ------------------------------------------------------------ motion
  /* the shared humanoid clip, plus the jaw (idle chatter, a gape at the thrust and when hit) and the eyes' ember pulse */
  function pose(fig, clip, t, T, C) {
    const r = C.base(fig, clip, t, T);
    let jaw = 0.05 * Math.max(0, Math.sin(T * 11)) * sstep(0.55, 0.75, Math.sin(T * 0.9)), glow = 0.12 * Math.sin(T * 2.1);
    if (clip === "attack") { const g = C.bump(0.28, 0.4, 0.55, 0.85, t); jaw = Math.max(jaw, 0.42 * g); glow += 1.2 * g; }
    else if (clip === "hurt") jaw = 0.32 * Math.exp(-t * 5) * C.sstep(0, 0.05, t);
    else if (clip === "victory") jaw = 0.22 * Math.abs(Math.sin(t * 13)) * C.bump(0, 0.3, 1.2, 1.6, t);
    C.rot(fig, "jaw", jaw, 0, 0);
    if (clip === "idle") C.addRot(fig, "head", 0, 0, 0.07 * Math.sin(T * 0.7));
    C.emitBoost(fig, glow);
    fig.root.updateMatrixWorld(true);
    return r;
  }

  return {
    cards: ["skeleton"], kind: "humanoid", build, pose, scale: 0.95,
    moves: { attack: { clip: "spear", style: "thrust", trail: { prop: "spear", from: [0, 0.3, 0], to: [0, SPEAR_TIP, 0] } } },
  };
})());
