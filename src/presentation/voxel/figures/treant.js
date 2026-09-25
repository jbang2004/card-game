/* 古木守护者 — ancient treant guardian: a bark trunk that is body and head, a wise carved face (heavy brow,
 * deep-set glowing eyes, long nose, a beard of bark), a crown of leaves, branch arms with big wooden hands,
 * moss and vines on the shoulders, root feet (card treant). */
EmberVoxelKit.define("treant", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, add, sub, mul, norm, cross, lerp, FAM, CLS, mats, armJoints, legJoints, sideName, humanoidBones } = K;
  const v = 0.0125, V = (n) => n * v;               // author in voxel units

  // lattice axes EmberVoxel gives a tilted bone's rigid segment (columns x, bone dir, x × dir)
  function frame(d) {
    let x = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    const dp = x[0] * d[0] + x[1] * d[1] + x[2] * d[2];
    x = norm([x[0] - dp * d[0], x[1] - dp * d[1], x[2] - dp * d[2]]);
    const z = cross(x, d);
    return { x, y: d, z, R: [x[0], d[0], z[0], x[1], d[1], z[1], x[2], d[2], z[2]] };
  }
  const inF = (F, O, l) => add(O, add(mul(F.x, l[0]), add(mul(F.y, l[1]), mul(F.z, l[2]))));
  // vertical elliptic column, radii varying with height, rounded rims
  function column(y0, y1, rx0, rx1, rz0, rz1, rr, zc = 0) {
    return S.custom((x, y, z) => {
      const u = clamp((y - y0) / (y1 - y0), 0, 1), rx = mix(rx0, rx1, u), rz = mix(rz0, rz1, u);
      const e = (Math.hypot(x / rx, (z - zc) / rz) - 1) * Math.min(rx, rz), cap = Math.max(y0 - y, y - y1);
      const qx = e + rr, qy = cap + rr;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rr;
    }, [-Math.max(rx0, rx1), y0, zc - Math.max(rz0, rz1), Math.max(rx0, rx1), y1, zc + Math.max(rz0, rz1)]);
  }
  const slerp = (a, b, u) => {
    const d = clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1), th = Math.acos(d);
    if (th < 1e-3) return norm(lerp(a, b, u));
    const sa = Math.sin((1 - u) * th) / Math.sin(th), sb = Math.sin(u * th) / Math.sin(th);
    return norm([a[0] * sa + b[0] * sb, a[1] * sa + b[1] * sb, a[2] * sa + b[2] * sb]);
  };

  function treant() {
    const sc = new Sculpture(), PX = K.pixel;   // PX: pixel-sprite variant (big planks, fat roots, few big leaf clumps)
    // a tall trunk with short root legs, long branch arms, the head a continuation of the trunk
    const P = { ...FAM.chunky,
      pelvis: [V(28), 0.13, 0.06, 0.1], waist: [V(36), 0.11, 0.09], chest: [V(47), 0.14, V(10), 0.11],
      neck: [V(56), V(59), 0.05, 0.05],
      shX: V(12.5), shY: V(53), upArm: V(12), foreArm: V(11), abd: 0.5,
      hipX: V(6), hipY: V(25), kneeX: V(6.5), kneeY: V(13), ankX: V(7), ankY: V(4),
    };
    humanoidBones(sc, P);
    sc.bone("crown", "head", 0, V(70), V(-1));
    // bark: vertical grooves wandering round the trunk
    const grooves = (x, y, z, nx, ny, nz, c) => {
      const a = Math.atan2(x, z - V(0.5)), g = Math.sin(a * 8 + 1.8 * vnoise(x * 14, y * 5, z * 14) + y * 6);
      const k = g > 0.62 ? 0.72 : g < -0.75 ? 1.1 : 1; c[0] *= k; c[1] *= k; c[2] *= k;
    };
    // leaves: lit tops, shaded undersides — reads as clumps rather than speckle
    const canopy = (x, y, z, nx, ny, nz, c) => { const k = ny > 0.55 ? 1.14 : ny < -0.35 ? 0.74 : 1; c[0] *= k; c[1] *= k; c[2] *= k; };
    mats(sc, PX ? {
      // flat, clearly separated tones: mid bark body, a lighter carved face, a dark beard, three distinct greens
      bark: { c: 0x7a5234, rough: 0.9, cls: CLS.wood }, limb: { c: 0x7a5234, rough: 0.9, cls: CLS.wood },
      plank: { c: 0x684328, rough: 0.9, cls: CLS.wood },
      face: { c: 0xa9794e, rough: 0.85, cls: CLS.wood }, barkL: { c: 0xc4945f, rough: 0.85, cls: CLS.wood },
      barkD: { c: 0x2a1a10, rough: 0.95, cls: CLS.wood },
      beard: { c: 0x4e3322, rough: 0.9, cls: CLS.wood }, beardL: { c: 0x4e3322, rough: 0.9, cls: CLS.wood },
      moss: { c: 0x6c9c2c, rough: 0.95, cls: CLS.plant },
      leaf: { c: 0x5a9e2c, rough: 0.8, cls: CLS.plant }, leafL: { c: 0x8cc83e, rough: 0.8, cls: CLS.plant },
      leafD: { c: 0x366a20, rough: 0.85, cls: CLS.plant }, vine: { c: 0x4a7a2a, rough: 0.85, cls: CLS.plant },
      eye: { c: 0xffd24a, rough: 0.3, emit: 1.8, cls: CLS.glow },
      eyeGlow: { c: 0x6a3a12, rough: 0.6, emit: 0.9, cls: CLS.glow },
    } : {
      bark: { c: 0x76523a, rough: 0.9, cls: CLS.wood, vary: 0.04, pattern: grooves },
      limb: { c: 0x74503a, rough: 0.9, cls: CLS.wood, vary: 0.05 },
      face: { c: 0x93694a, rough: 0.85, cls: CLS.wood, vary: 0.03 },
      barkL: { c: 0xa57a54, rough: 0.85, cls: CLS.wood, vary: 0.03 },
      barkD: { c: 0x3a2418, rough: 0.95, cls: CLS.wood },
      beard: { c: 0x6a4a34, rough: 0.9, cls: CLS.wood, vary: 0.04 },
      beardL: { c: 0x86644a, rough: 0.9, cls: CLS.wood, vary: 0.04 },
      moss: { c: 0x5d7a2a, rough: 0.95, cls: CLS.plant },
      leaf: { c: 0x5a9a2c, rough: 0.8, cls: CLS.plant, vary: 0.04, pattern: canopy },
      leafL: { c: 0x80bb3c, rough: 0.8, cls: CLS.plant, vary: 0.04, pattern: canopy },
      leafD: { c: 0x3a6d22, rough: 0.85, cls: CLS.plant, pattern: canopy },
      vine: { c: 0x4a7a2a, rough: 0.85, cls: CLS.plant },
      eye: { c: 0xffd24a, rough: 0.3, emit: 1.8, cls: CLS.glow },
      eyeGlow: { c: 0x6a3a12, rough: 0.6, emit: 0.9, cls: CLS.glow },
    });

    // ---- trunk: one column split by height into pelvis / waist / chest, flaring at the base
    const tr = sc.add(column(V(21), V(56), V(12), V(11.5), V(10), V(9.5), V(3), V(0.5)), { mat: "bark", bone: "chest", k: 0.004, cs: 0.03 });
    tr.wfn = (x, y) => (y < V(32) ? [["root", 1]] : y < V(43) ? [["spine", 1]] : [["chest", 1]]);
    sc.add(S.ell(V(12.5), V(5), V(10.5)), { mat: "bark", p: [0, V(24), V(0.5)], bone: "root", k: 0.01, cs: 0.03 });
    // raised fibres twisting up the trunk (the grooves between them come from the bark pattern)
    const onTrunk = (x, y, out) => { const u = clamp((y - V(21)) / V(35), 0, 1), rx = mix(V(12), V(11.5), u), rz = mix(V(10), V(9.5), u); return [x, y, V(0.5) + (rz + out) * Math.sqrt(Math.max(0, 1 - (x / (rx + out)) ** 2))]; };
    // pixel: a few big straight bark planks round the sides and back instead of the twisting fibres
    if (PX) for (const a of [1.9, -1.9, Math.PI]) {
      const at = (y, out) => { const u = clamp((y - V(21)) / V(35), 0, 1), rx = mix(V(12), V(11.5), u) + out, rz = mix(V(10), V(9.5), u) + out; return [rx * Math.sin(a), y, V(0.5) + rz * Math.cos(a)]; };
      const f = sc.add(S.chain([[...at(V(23), 0), V(2.2)], [...at(V(38), 0), V(2.2)], [...at(V(51), -V(0.3)), V(2)]]), { mat: "plank", bone: "spine", k: 0.006, cs: 0.03 });
      f.wfn = tr.wfn;
    }
    if (!PX) for (const [x0, x1, y0, y1] of [[-7.5, -3, 22, 46], [8, 5, 23, 44], [1, 6.5, 30, 50]]) {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const u = i / 10, x = V(mix(x0, x1, u) + 1.1 * Math.sin(u * 4.2)); pts.push([...onTrunk(x, V(mix(y0, y1, u)), V(0.1)), V(1.35 - 0.4 * Math.abs(u - 0.45))]); }
      const f = sc.add(S.chain(pts), { mat: "limb", bone: "spine", k: 0.008, cs: 0.03 });
      f.wfn = tr.wfn;
    }
    // shoulders: rounded masses, mossy on top
    for (const s of [1, -1]) sc.add(S.ell(V(6.5), V(6), V(7)), { mat: "bark", p: [s * V(12), V(52), V(0)], bone: "chest", k: 0.012, cs: 0.03 });
    for (const s of [1, -1]) sc.paint(S.ell(V(8), V(3.5), V(8)), { mat: "moss", p: [s * V(12.5), V(58), V(-0.5)], soft: 0.001 });
    sc.paint(S.ell(V(9), V(2.5), V(8)), { mat: "moss", p: [V(2), V(57.5), V(-4)], soft: 0.001 });

    // ---- head: the upper trunk with a carved face
    sc.add(column(V(55), V(71), V(8.5), V(8), V(8), V(7.5), V(2.5), V(0.5)), { mat: "bark", bone: "head", k: 0.004, cs: 0.03 });
    sc.paint(S.custom((x, y, z) => Math.max(Math.abs(x) - V(7), z - V(20), V(5) - z, Math.abs(y - V(63)) - V(7)), [-0.1, 0.7, 0, 0.1, 0.9, 0.3]), { mat: "face", soft: 0.001, only: ["bark"] });
    for (const s of [1, -1]) sc.add(S.ell(V(3), V(2.6), V(2.5)), { mat: "face", p: [s * V(5.2), V(60.5), V(6.2)], bone: "head", k: 0.01, cs: 0.03 });
    // heavy V-shaped brow, deep dark sockets under it, glowing eyes at the back of the sockets
    for (const s of [1, -1]) sc.limb([s * V(0.5), V(66.2), V(9.3)], [s * V(7.8), V(68.4), V(6.6)], V(2.1), V(1.5), { mat: "barkL", bone: "head", k: 0.006, cs: 0.03 });
    for (const s of [1, -1]) sc.add(S.ell(V(2.4), V(1.5), V(2.6)), { op: "sub", p: [s * V(3.4), V(64.2), V(8.8)], bone: "head", k: 0.003 });
    for (const s of [1, -1]) sc.paint(S.ell(V(2.8), V(1.9), V(2.8)), { mat: "barkD", p: [s * V(3.4), V(64.2), V(8.4)], soft: 0.001 });
    for (const s of [1, -1]) sc.paint(S.ell(V(2.2), V(1.2), V(2.2)), { mat: "eyeGlow", p: [s * V(3.2), V(64.2), V(7.4)], soft: 0.001 });
    for (const s of [1, -1]) sc.paint(PX ? S.box(V(1.5), V(1), V(1.5)) : S.box(V(1), V(0.5), V(1.5)), { mat: "eye", p: [s * V(3), V(64.5), V(6.8)], soft: 0.001 });
    // long nose with a knot at the tip
    sc.limb([0, V(66), V(9)], [0, V(59.8), V(11)], V(1.4), V(1.5), { mat: "barkL", bone: "head", k: 0.005, cs: 0.03 });
    sc.add(S.sphere(V(1.8)), { mat: "barkL", p: [0, V(59.6), V(10.8)], bone: "head", k: 0.005, cs: 0.03 });

    // ---- arms: branch limbs with an elbow knot, big open wooden hands
    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      const Fa = frame(norm(sub(a.E, a.S))), Ff = frame(norm(sub(a.W, a.E)));   // F.x points outward × s, F.z ≈ −Z (front = −z)
      sc.add(S.chain([[...inF(Fa, a.S, [0, V(-1), 0]), V(5.6)], [...inF(Fa, a.S, [s * V(0.8), V(6), V(0.5)]), V(5.1)], [...a.E, V(4.8)]]), { mat: "limb", bone: "arm" + n, k: 0.006, cs: 0.03 });
      sc.add(S.sphere(V(5)), { mat: "limb", p: inF(Ff, a.E, [s * V(0.4), V(0.5), V(0.4)]), bone: "fore" + n, k: 0.006, cs: 0.03 });
      sc.add(S.chain([[...a.E, V(4.8)], [...inF(Ff, a.E, [s * V(-0.5), V(6), 0]), V(4.5)], [...inF(Ff, a.E, [0, V(11.5), 0]), V(4.2)]]), { mat: "limb", bone: "fore" + n, k: 0.006, cs: 0.03 });
      // moss along the top of the upper arm
      sc.paint(S.ell(V(5.5), V(8), V(5.5)), { mat: "moss", p: inF(Fa, a.S, [s * V(4), V(3.5), 0]), R: Fa.R, soft: 0.001, only: ["limb"] });
      // palm (thickness across x, width front-back), four thick curled fingers, a thumb in front
      sc.add(S.box(V(3.2), V(4.4), V(6), V(1.8)), { mat: "limb", p: inF(Ff, a.W, [s * V(-0.3), V(4), 0]), R: Ff.R, bone: "hand" + n, k: 0.006, cs: 0.03 });
      for (const zi of [-4.3, -1.45, 1.45, 4.3]) {
        const L = zi === 4.3 ? 0.82 : zi === -4.3 ? 0.92 : 1;
        sc.add(S.chain([[...inF(Ff, a.W, [s * V(-0.3), V(7.5), V(zi)]), V(1.95)], [...inF(Ff, a.W, [s * V(-1.2), V(7.5 + 4.5 * L), V(zi * 1.04)]), V(1.75)], [...inF(Ff, a.W, [s * V(-3.2), V(7.5 + 8.5 * L), V(zi * 1.08)]), V(1.4)]]),
          { mat: "limb", bone: "hand" + n, k: 0.004, cs: 0.03 });
      }
      sc.add(S.chain([[...inF(Ff, a.W, [s * V(-0.8), V(3), V(-5.2)]), V(1.9)], [...inF(Ff, a.W, [s * V(-2), V(6.5), V(-7.6)]), V(1.7)], [...inF(Ff, a.W, [s * V(-3.4), V(9.5), V(-8.2)]), V(1.4)]]),
        { mat: "limb", bone: "hand" + n, k: 0.004, cs: 0.03 });
    }
    // a vine winding round the left upper arm, and one hanging from the right shoulder, with a few leaves
    if (!PX) {
      const a = armJoints(P, 1), Fa = frame(norm(sub(a.E, a.S))), pts = [];
      for (let i = 0; i <= 18; i++) { const u = i / 18, th = 0.6 + u * Math.PI * 2.4; pts.push([...inF(Fa, a.S, [V(4.9) * Math.cos(th), V(-1 + 13 * u), V(4.9) * Math.sin(th)]), V(0.55)]); }
      sc.add(S.chain(pts), { mat: "vine", bone: "armL", k: 0.002, cs: 0.02, vdil: 0.6 });
      for (const i of [3, 9, 15]) sc.add(S.ell(V(1.6), V(0.7), V(1.2)), { mat: "leafL", p: add(pts[i].slice(0, 3), mul(norm(sub(pts[i].slice(0, 3), inF(Fa, a.S, [0, V(-1 + 13 * i / 18), 0]))), V(1))), bone: "armL", k: 0.002, cs: 0.02, vdil: 0.5 });
      const hv = [];
      for (let i = 0; i <= 12; i++) { const u = i / 12; hv.push([-V(12) + V(3) * u, V(58) - V(14) * u, V(6.5) + V(3.5) * Math.sin(u * 1.6), V(0.55)]); }
      sc.add(S.chain(hv), { mat: "vine", bone: "chest", k: 0.002, cs: 0.02, vdil: 0.6 });
      for (const i of [4, 8, 12]) sc.add(S.ell(V(1.5), V(1.1), V(0.6)), { mat: "leaf", p: add(hv[i].slice(0, 3), [V(i % 8 ? 1 : -1), 0, V(0.6)]), bone: "chest", k: 0.002, cs: 0.02, vdil: 0.5 });
    }

    // ---- legs: short trunk legs flaring into root feet
    for (const s of [1, -1]) {
      const n = sideName(s), l = legJoints(P, s);
      sc.limb(l.H, l.K, V(6), V(5.6), { mat: "limb", bone: "thigh" + n, k: 0.008, cs: 0.03 });
      sc.limb(l.K, add(l.A, [0, V(3.5), 0]), V(5.6), V(6.2), { mat: "limb", bone: "shin" + n, k: 0.008, cs: 0.03 });
      sc.add(S.ell(V(6.5), V(3), V(6.5)), { mat: "limb", p: [l.A[0], V(2.8), l.A[2]], bone: "foot" + n, k: 0.01, cs: 0.03 });
      // root toes (pixel: three fat roots)
      const roots = PX ? [[0.2, 1, 10], [1, 0.1, 8], [-0.1, -1, 7]] : [[0.15, 1, 11], [0.8, 0.6, 9], [1, -0.15, 8], [0.45, -0.9, 8], [-0.45, 0.9, 8]];
      const rr = PX ? [3.4, 2.9, 2.2] : [2.8, 2, 1.2];
      for (const [dx, dz, len] of roots) {
        const d = norm([s * dx, 0, dz]), p0 = [l.A[0] + d[0] * V(3), V(4), l.A[2] + d[2] * V(3)];
        sc.add(S.chain([[...p0, V(rr[0])], [p0[0] + d[0] * V(len * 0.5), V(PX ? 2.9 : 2.4), p0[2] + d[2] * V(len * 0.5), V(rr[1])], [p0[0] + d[0] * V(len), V(PX ? 2.2 : 1.4), p0[2] + d[2] * V(len), V(rr[2])]]),
          { mat: "limb", bone: "foot" + n, k: 0.006, cs: 0.03 });
      }
      sc.paint(S.ell(V(5), V(1.5), V(5)), { mat: "moss", p: [l.A[0] + s * V(2), V(5.5), l.A[2] + V(3)], soft: 0.001 });
    }

    // ---- beard: bark strands from the chin down over the chest (drapes between head and chest)
    sc.inPart("hair", () => {
      // beard strands (pixel: three big locks, one colour)
      const NB = PX ? 3 : 7;
      for (let i = 0; i < NB; i++) {
        const u = (i / (NB - 1) - 0.5) * (PX ? 0.8 : 1), top = [u * V(10), V(60) - Math.abs(u) * V(1.5), V(8.8) - Math.abs(u) * V(2.5)];
        const mid = [u * V(9.5), V(52), V(11)], tip = [u * V(4), V(42.5) + Math.abs(u) * V(9), V(11.2)];
        const b = sc.add(S.bez(top, mid, tip, PX ? V(i === 1 ? 3.6 : 3) : V(1.8), PX ? V(1.8) : V(0.9)), { mat: i % 2 ? "beard" : "beardL", bone: "head", k: 0.005, cs: 0.03 });
        b.wfn = (x, y) => { const w = sstep(V(50), V(59), y); return [["head", w], ["chest", 1 - w]]; };
      }
      // ---- crown of leaves: an irregular mass of clumps, higher over the brow, hanging low at the temples and
      // the back of the head; its upper half sways on the crown bone
      const cw = (x, y) => { const w = sstep(V(71), V(80), y); return [["head", 1 - w], ["crown", w]]; };
      const cl = (p, r, mat) => { const pr = sc.add(S.ell(r, r * 0.84, r), { mat, p, bone: "head", k: 0.01, cs: 0.03 }); pr.wfn = cw; return pr; };
      cl([0, V(73), V(-1.5)], V(PX ? 9.5 : 8.5), "leaf");
      // pixel: a few big clumps — light on the brow and crown, dark at the back and temples
      const C = PX ? [
        [0, 72, 6, 5, "leafL"], [7, 71, 1.5, 5.5, "leaf"], [8, 67.5, -6, 5.5, "leafD"], [0, 67, -9, 5.5, "leafD"],
        [5, 78, -2, 6, "leafL"], [0, 81, -3, 5.5, "leafL"], [6.5, 75, -7, 5.5, "leaf"],
      ] : [
        [0, 71, 7, 4.2, "leafL"], [4.8, 70.8, 6.2, 4, "leafL"], [9, 70, 1.5, 4.5, "leaf"], [11, 66.5, -2, 4, "leafD"], [6.5, 68, -7.5, 5, "leafD"],
        [0, 65.5, -9, 5, "leafD"], [3, 71, -9.5, 4.5, "leaf"], [7.5, 76, -0.5, 5, "leaf"], [0, 78, -4, 5.5, "leafL"], [4, 80.5, 1, 4.5, "leafL"],
        [5, 77, -6.5, 4.5, "leaf"], [0, 82.5, -1, 4, "leafL"], [9.5, 74, -4.5, 4.5, "leaf"], [2.5, 75.5, 4, 4, "leaf"],
      ];
      for (const [x, y, z, r, m] of C) for (const s of x ? [1, -1] : [1]) cl([s * V(x) + (s < 0 ? V(0.6) : 0), V(y + (s < 0 ? 0.7 : 0)), V(z)], V(r), s < 0 && m === "leafL" && !PX ? "leaf" : m);
    });
    // two gnarled branches curving up and out of the crown like antlers, a fork near the top, leaves along the
    // lower half, bare twig tips
    for (const s of [1, -1]) {
      const X = (x) => s * V(x);
      if (PX) {   // pixel: one fat branch with one fork and two big leaf clumps
        sc.add(S.chain([[X(6), V(74), V(-3), V(2.6)], [X(11), V(78), V(-3.5), V(2.2)], [X(16), V(81), V(-3.5), V(1.9)], [X(19.5), V(87), V(-3.5), V(1.6)]]), { mat: "limb", bone: "crown", k: 0.003, cs: 0.03 });
        sc.add(S.chain([[X(15), V(80.5), V(-3.5), V(1.7)], [X(13.5), V(87), V(-4.5), V(1.5)]]), { mat: "limb", bone: "crown", k: 0.002, cs: 0.03 });
        sc.inPart("hair", () => {
          for (const [x, y, z, r, m] of [[13, 79.5, -1, 3.6, "leafL"], [17, 83, -5, 3.4, "leaf"]])
            sc.add(S.ell(V(r), V(r * 0.8), V(r)), { mat: m, p: [X(x), V(y), V(z)], bone: "crown", k: 0.004, cs: 0.03 });
        });
        continue;
      }
      sc.add(S.chain([[X(6), V(74), V(-3), V(1.9)], [X(10.5), V(77.5), V(-4), V(1.6)], [X(15), V(80), V(-3.5), V(1.3)], [X(18.5), V(84.5), V(-3), V(1)], [X(20), V(89), V(-3.5), V(0.7)]]), { mat: "limb", bone: "crown", k: 0.003, cs: 0.03, vdil: 0.55 });
      sc.add(S.chain([[X(15), V(80), V(-3.5), V(1.1)], [X(14.5), V(85), V(-5), V(0.8)], [X(13), V(89.5), V(-5.5), V(0.6)]]), { mat: "limb", bone: "crown", k: 0.002, cs: 0.03, vdil: 0.55 });
      sc.add(S.chain([[X(18.5), V(84.5), V(-3), V(0.8)], [X(22), V(86), V(-2), V(0.6)]]), { mat: "limb", bone: "crown", k: 0.002, cs: 0.03, vdil: 0.55 });
      sc.inPart("hair", () => {
        for (const [x, y, z, r, m] of [[12, 79.5, -1, 2.8, "leafL"], [16.5, 78.5, -5.5, 2.6, "leaf"], [16, 82.5, -1, 2.3, "leafL"], [12.5, 84, -6.5, 2.2, "leaf"]])
          sc.add(S.ell(V(r), V(r * 0.75), V(r)), { mat: m, p: [X(x), V(y), V(z)], bone: "crown", k: 0.004, cs: 0.03 });
      });
    }
    return { sc, P, kind: "humanoid", props: [] };
  }

  // posture over the shared humanoid clips: long arms hang with a slight bend, hands clear of the hips; leaves sway
  // The trunk is one continuous column split across root/spine/chest: bending between those segments would open
  // seams, so their rotations are folded into the root (the trunk leans as one piece) and the head moves gently.
  function rigidTrunk(fig) {
    const J = fig.J;
    J.root.quaternion.multiply(J.spine.quaternion).multiply(J.chest.quaternion);
    J.spine.quaternion.identity(); J.chest.quaternion.identity();
    J.neck.quaternion.identity(); J.head.quaternion.slerp(J.spine.quaternion, 0.55);
  }
  // twist a forearm about its own (rest) axis: turns the hand without moving the wrist
  function twist(fig, n, ang) {
    if (!ang) return;
    const o = fig.J["fore" + n], a = armJoints(fig.char.P, n === "L" ? 1 : -1), d = norm(sub(a.W, a.E));
    o.quaternion.multiply(o.quaternion.clone().setFromAxisAngle(o.position.clone().set(d[0], d[1], d[2]), ang));
  }
  const PALM_UP = -1.45;
  function settle(fig, C, T) {
    rigidTrunk(fig);
    for (const b of ["thighL", "thighR", "shinL", "shinR", "footL", "footR"]) fig.J[b].quaternion.identity();   // rooted: sways from the base
    // the left hand held out in front, palm up, as on the card; the right arm hangs heavy
    C.rot(fig, "foreL", -0.78 + 0.03 * Math.sin(T * 0.9), 0.1, 0); twist(fig, "L", PALM_UP);
    C.rot(fig, "foreR", -0.3, 0, 0);
    C.addRot(fig, "armL", -0.12, 0, 0.04); C.addRot(fig, "armR", 0, 0, -0.06);
    C.rot(fig, "crown", 0.03 * Math.sin(T * 1.1), 0, 0.045 * Math.sin(T * 0.83));
  }
  function level(fig, name, amt) {
    const o = fig.J[name]; if (!o || amt <= 0) return;
    fig.root.updateMatrixWorld(true);
    const q = o.parent.getWorldQuaternion(o.quaternion.clone()).invert().multiply(fig.root.getWorldQuaternion(o.quaternion.clone()));
    o.quaternion.slerp(q, amt);
  }

  const HIT = 0.5, LEN = 1.3, STRIKE = 1.2;
  // swing path of the left hand as directions from the shoulder (model space)
  const D = { hang: norm([0.18, -0.97, 0.12]), wind: norm([0.3, 0.88, -0.37]), hit: norm([-0.12, -0.84, 0.53]), follow: norm([-0.52, -0.83, 0.2]) };
  // the whole tree pitches, twists and rolls about a point between its roots (feet stay put): rigid, like a trunk bending
  // (layered on the idle's own sway: the base point under the idle pose is what stays put)
  function lean(fig, C, x, y, z, dy = 0, dz = 0) {
    const r = fig.J.root, hp = fig.rest.get(r).p.y;
    const before = C.V3(0, -hp, 0).applyQuaternion(r.quaternion);
    C.addRot(fig, "root", x, y, z);
    const after = C.V3(0, -hp, 0).applyQuaternion(r.quaternion);
    r.position.x += before.x - after.x; r.position.y += before.y - after.y + dy; r.position.z += before.z - after.z + dz;
  }
  return {
    cards: ["treant"], kind: "humanoid", build: treant, scale: 1.2,
    moves: { attack: { clip: "swipe", hit: HIT, length: LEN, style: "blunt" } },
    pose(fig, clip, t, T, C) {
      const glow = 0.08 * Math.sin(T * 1.3);
      if (clip !== "attack") {
        const r = C.base(fig, clip, t, T);
        settle(fig, C, T);
        C.emitBoost(fig, glow);
        return r;
      }
      const { addRot, ik, toW, toM, wpos, bump, V3 } = C, P = fig.char.P, e = (a, b) => sstep(a, b, t);
      C.base(fig, "idle", 0, T);
      settle(fig, C, T);
      // wind-up: rear back and twist away, the left arm high behind the shoulder (0-0.36) → pitch forward from the
      // roots, a clubbing swing over the front, the open hand smashing down low in front (0.36-0.5) → follow through
      // across the body (→0.64) → hold, then straighten (→1.2)
      const wind = e(0.02, 0.32) * (1 - e(0.36, 0.47));
      const swing = e(0.37, HIT) * (1 - e(0.74, 1.2));
      const foll = e(0.47, 0.64) * (1 - e(0.76, 1.14));
      const shake = t > HIT ? Math.sin((t - HIT) * 58) * Math.exp(-(t - HIT) * 10) : 0;
      lean(fig, C, -0.11 * wind + 0.3 * swing + 0.01 * shake, 0.42 * wind - 0.32 * swing - 0.16 * foll, 0.05 * wind - 0.05 * swing, -0.012 * swing, 0);
      addRot(fig, "head", 0.1 * wind - 0.2 * swing, -0.3 * wind + 0.24 * swing + 0.1 * foll, 0);
      addRot(fig, "crown", 0.22 * wind - 0.3 * swing + 0.14 * foll + 0.06 * shake, 0, -0.16 * wind + 0.22 * swing - 0.1 * foll);
      // the right arm swings the other way for balance
      addRot(fig, "armR", -0.5 * wind + 0.6 * swing, 0, -0.18 * wind + 0.1 * swing);
      // left arm: along the swing path, nearly straight through the strike
      let dir, rr;
      if (t < 0.36) { const u = e(0.02, 0.32); dir = slerp(D.hang, D.wind, u); rr = mix(0.96, 0.82, u); }
      else if (t < HIT) { const u = clamp((t - 0.36) / (HIT - 0.36), 0, 1) ** 1.7; dir = slerp(D.wind, D.hit, u); rr = mix(0.82, 0.99, u); }
      else if (t < 0.64) { const u = e(HIT, 0.64); dir = slerp(D.hit, D.follow, u); rr = 0.97; }
      else { const u = e(0.72, 1.16); dir = slerp(D.follow, D.hang, u); rr = mix(0.97, 0.96, u); }
      const armAmt = e(0, 0.08) * (1 - e(1.1, 1.26));
      fig.root.updateMatrixWorld(true);
      const Sm = toM(fig, wpos(fig.J.armL)), reach = (P.upArm + P.foreArm) * rr;
      const target = V3(Sm.x + dir[0] * reach, Sm.y + dir[1] * reach + 0.006 * shake, Sm.z + dir[2] * reach);
      ik(fig, "armL", "foreL", "handL", toW(fig, target), toW(fig, V3(Sm.x + 0.45, Sm.y - 0.25, Sm.z - 0.2)), armAmt);
      // turn the forearm from the idle's palm-up to a flat downward smack on the strike
      twist(fig, "L", (STRIKE - PALM_UP) * e(0.3, 0.46) * (1 - e(0.76, 1.12)));
      C.emitBoost(fig, glow + 0.9 * wind + 0.6 * bump(HIT - 0.04, HIT, 0.6, 0.85, t));
      return t < LEN;
    },
  };
})());
