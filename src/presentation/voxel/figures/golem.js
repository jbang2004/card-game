/* 符文石像 — hulking rune golem of carved dark stone: small visored helm, boulder shoulders, huge
 * block fists, a torso shaped like a great heater shield with a glowing emerald rune (card golem). */
EmberVoxelKit.define("golem", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, vnoise, clamp, mix, sstep, add, sub, mul, norm, cross, FAM, CLS, mats, armJoints, sideName, humanoidBones } = K;
  // author in voxel units: a box whose faces fall on whole voxels (centre ± half-size integral) lands on the lattice
  const v = 0.0125, V = (n) => n * v;

  // lattice axes EmberVoxel gives a tilted bone's rigid segment (columns x, bone dir, x × dir):
  // blocks authored in this frame come out with flat, stair-free faces
  function frame(d) {
    let x = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    const dp = x[0] * d[0] + x[1] * d[1] + x[2] * d[2];
    x = norm([x[0] - dp * d[0], x[1] - dp * d[1], x[2] - dp * d[2]]);
    const z = cross(x, d);
    return { x, y: d, z, R: [x[0], d[0], z[0], x[1], d[1], z[1], x[2], d[2], z[2]] };
  }
  const WORLD = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], R: null };
  const inF = (F, O, l) => add(O, add(mul(F.x, l[0]), add(mul(F.y, l[1]), mul(F.z, l[2]))));

  // heater shield outline in XY: flat top yT with chamfered corners, straight sides |x| = w down to yS, arcs meeting at the tip yB
  function heater(w, yT, yS, yB, ch) {
    const h = yS - yB, c = (h * h - w * w) / (2 * w), R = w + c;
    return (x, y) => {
      const ax = Math.abs(x);
      const d = y >= yS ? ax - w : Math.hypot(ax + c, y - yS) - R;
      return Math.max(d, y - yT, (ax + y - (w + yT - ch)) * Math.SQRT1_2);
    };
  }
  const boxSd = (x, y, z, c, h) => Math.max(Math.abs(x - c[0]) - h[0], Math.abs(y - c[1]) - h[1], Math.abs(z - c[2]) - h[2]);

  function golem() {
    const sc = new Sculpture();
    // stout proportions: short thick legs, wide high shoulders, long arms, a small head sunk between the shoulders
    const P = { ...FAM.chunky,
      pelvis: [V(32.5), 0.13, 0.06, 0.1], waist: [V(39), 0.11, 0.085], chest: [V(50), 0.17, 0.12, 0.11],
      neck: [V(59), V(63), 0.05, 0.045],
      shX: V(16), shY: V(58), upArm: V(14), foreArm: Math.sqrt(V(13) ** 2 - 0.012 ** 2), abd: 0.5,
      hipX: V(7), hipY: V(30), kneeX: V(7), kneeY: V(16), ankX: V(7), ankY: V(5),
    };
    humanoidBones(sc, P);
    // weathered stone: brightness steps in 3-voxel patches (blocky mottling, no per-voxel speckle)
    const blot = (x, y, z, nx, ny, nz, c) => { const k = 1 + 0.05 * vnoise(Math.floor(x / V(3)), Math.floor(y / V(3)), Math.floor(z / V(3))); c[0] *= k; c[1] *= k; c[2] *= k; };
    mats(sc, {
      stone: { c: 0x646a74, rough: 0.85, metal: 0.1, cls: CLS.metal, vary: 0, pattern: blot, vox: 0.25 },
      stoneL: { c: 0x79808b, rough: 0.8, metal: 0.1, cls: CLS.metal, vary: 0, pattern: blot, vox: 0.25 },
      stoneD: { c: 0x4d525c, rough: 0.9, metal: 0.1, cls: CLS.metal, vary: 0, pattern: blot, vox: 0.25 },
      seam: { c: 0x2c2f37, rough: 0.95, metal: 0, cls: CLS.metal, vox: 0.25 },
      rune: { c: 0x4ef2b2, rough: 0.4, emit: 1.8, cls: CLS.glow },
    });
    const blk = (bone, F, O, c, h, o = {}) => sc.add(S.box(h[0], h[1], h[2], o.r ?? V(1)), { mat: o.mat || "stone", p: inF(F, O, c), R: F.R, bone, k: o.k ?? 0.002, cs: 0.02 });
    const O0 = [0, 0, 0];

    // ---- torso: pelvis and waist blocks, chest core + hunched back, the shield plate in front
    blk("root", WORLD, O0, [0, V(32.5), V(-1.5)], [V(11), V(4.5), V(7.5)], { r: V(1.5), mat: "stoneD" });
    blk("spine", WORLD, O0, [0, V(39), V(-2)], [V(10), V(4), V(7)], { r: V(1.5), mat: "stoneD" });
    // one chest block, deep and hunched: the back-bottom edge cut away in a long slope
    sc.add(S.custom((x, y, z) => Math.max(boxSd(x, y, z, [0, V(52), V(-4.5)], [V(12), V(10), V(9.5)]), (V(9) - (z + V(14)) - (y - V(42))) * Math.SQRT1_2,
      (Math.abs(x) - V(12) + (y - V(62)) + V(2.5)) * Math.SQRT1_2, (-(z + V(14)) + (y - V(62)) + V(2.5)) * Math.SQRT1_2),
      [-V(12), V(42), V(-14), V(12), V(62), V(5)]), { mat: "stone", bone: "chest", k: 0.002, cs: 0.02 });
    blk("neck", WORLD, O0, [0, V(61), V(-1)], [V(4), V(2), V(4)], { r: V(0.8), mat: "stoneD" });
    // masonry seams across the back
    sc.paint(S.custom((x, y, z) => {
      if (z > V(-9)) return 1;
      const hz = Math.abs(y - V(55.5)) - V(0.5), a = y > V(55) ? Math.abs(x - V(3.5)) - V(0.5) : Math.abs(x + V(4.5)) - V(0.5);
      return Math.min(hz, Math.max(a, V(46) - y));
    }, [-0.3, V(40), -0.3, 0.3, V(64), V(-9)]), { mat: "seam", soft: 0.001, only: ["stone"] });

    const yT = V(63), yS = V(49), yB = V(31), W = V(14), zF = V(9), zB = V(3);
    const sh2 = heater(W, yT, yS, yB, V(3)), shIn = heater(W - V(2), yT - V(2), yS, yB + V(3), V(2));
    sc.add(S.custom((x, y, z) => Math.max(sh2(x, y), Math.abs(z - (zF + zB) / 2) - (zF - zB) / 2), [-W, yB, zB, W, yT, zF]), { mat: "stoneL", bone: "chest", k: 0.002, cs: 0.02 });
    // inner panel one layer below the rim
    sc.add(S.custom((x, y, z) => Math.max(shIn(x, y), zF - V(1) - z, z - zF - V(3)), [-W, yB, zF - V(1), W, yT, zF + V(3)]), { op: "sub", bone: "chest", k: 0.001 });
    // medallion: a raised ring back at the rim's level, the interior sunk a layer below the panel
    const yc = V(51), rO = V(9), rI = V(7);
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, y - yc) - rO, Math.abs(z - (zF - V(0.5))) - V(0.5)), [-rO, yc - rO, zF - V(1), rO, yc + rO, zF]), { mat: "stoneL", bone: "chest", k: 0.001, cs: 0.02 });
    sc.add(S.custom((x, y, z) => Math.max(Math.hypot(x, y - yc) - rI, zF - V(2) - z, z - zF - V(3)), [-rI, yc - rI, zF - V(2), rI, yc + rI, zF + V(3)]), { op: "sub", bone: "chest", k: 0.001 });
    sc.paint(S.custom((x, y, z) => Math.max(shIn(x, y), rO - Math.hypot(x, y - yc), zF - V(3) - z), [-W, yB, zF - V(3), W, yT, zF + V(1)]), { mat: "stone", soft: 0.001 });
    sc.paint(S.custom((x, y, z) => Math.max(Math.hypot(x, y - yc) - rI, zF - V(3.5) - z), [-rI, yc - rI, 0, rI, yc + rI, zF + V(1)]), { mat: "seam", soft: 0.001 });
    // the rune: a diamond outline round a small solid diamond, and a stem from its lower tip down the shield
    const dy = yc + V(1), ra = V(4.6), rb = V(5.6), nrm = Math.hypot(1 / ra, 1 / rb);
    const rune = (x, y, z) => {
      const ax = Math.abs(x), yy = y - dy;
      const outline = Math.abs(ax / ra + Math.abs(yy) / rb - 1) / nrm - V(0.62);
      const core = (ax / V(1.9) + Math.abs(yy) / V(2.4) - 1) / Math.hypot(1 / V(1.9), 1 / V(2.4));
      const stem = Math.max(ax - V(0.6), yy + rb - V(0.3), yB + V(5.5) - y);
      return Math.max(Math.min(outline, core, stem), zF - V(3.5) - z);
    };
    sc.paint(S.custom(rune, [-W, yB, 0, W, yT, zF + V(1)]), { mat: "rune", soft: 0.001 });

    // ---- head: a small peaked helm with a crest ridge, a nose guard and a glowing visor slit
    const hc = [0, V(68), V(0.5)], hh = [V(6), V(5), V(5.5)];
    sc.add(S.custom((x, y, z) => Math.max(boxSd(x, y, z, hc, hh), (Math.abs(x) + y - V(6 + 73 - 2.5)) * Math.SQRT1_2, (z + y - V(6 + 73 - 1.2)) * Math.SQRT1_2),
      [-hh[0], hc[1] - hh[1], hc[2] - hh[2], hh[0], hc[1] + hh[1], hc[2] + hh[2]]), { mat: "stone", bone: "head", k: 0.002, cs: 0.02 });
    blk("head", WORLD, O0, [0, V(73.5), V(0.5)], [V(1), V(1.5), V(4.5)], { r: V(0.4), mat: "stoneL" });
    blk("head", WORLD, O0, [0, V(65.5), V(6.5)], [V(1), V(2.5), V(0.5)], { r: V(0.2), mat: "stoneL" });
    blk("head", WORLD, O0, [0, V(70), V(6.5)], [V(6), V(1), V(0.5)], { r: V(0.2), mat: "stoneL" });   // brow over the visor
    sc.add(S.box(V(4), V(0.5), V(2)), { op: "sub", p: [0, V(68.5), V(7)], bone: "head", k: 0.001 });
    sc.paint(S.box(V(4), V(0.5), V(0.5)), { mat: "rune", p: [0, V(68.5), V(4.5)], soft: 0.001 });

    for (const s of [1, -1]) {
      const n = sideName(s), a = armJoints(P, s);
      const Fa = frame(norm(sub(a.E, a.S))), Ff = frame(norm(sub(a.W, a.E)));   // F.x points outward × s; F.z ≈ −Z (front = −z)
      // ---- shoulder boulder on the collar bone (it stays with the torso; the arm swings out from under it),
      // chamfered to slope down outward, a carved square with a raised diamond on its outer face
      const pc = [s * V(18.5), V(57.5), V(-0.5)], ph = [V(7.5), V(6.5), V(6.5)];
      sc.add(S.custom((x, y, z) => { const X = s * x; return Math.max(boxSd(X, y, z, [V(18.5), pc[1], pc[2]], ph), (X - V(26) + y - V(64) + V(4.5)) * Math.SQRT1_2, (V(11) - X + y - V(64) + V(1.5)) * Math.SQRT1_2,
        (Math.abs(z - pc[2]) - ph[2] + y - V(64) + V(1.5)) * Math.SQRT1_2, (Math.abs(z - pc[2]) - ph[2] + Math.abs(X - V(18.5)) - ph[0] + V(2)) * Math.SQRT1_2); },
        s > 0 ? [V(11), V(51), V(-7), V(26), V(64), V(6)] : [-V(26), V(51), V(-7), -V(11), V(64), V(6)]), { mat: "stone", bone: "clav" + n, k: 0.002, cs: 0.02 });
      const sq = [V(55.5), V(-0.5)];
      sc.paint(S.custom((x, y, z) => Math.max(Math.abs(Math.max(Math.abs(y - sq[0]), Math.abs(z - sq[1])) - V(3)) - V(0.5), V(25) - s * x), [-0.4, V(50), -0.2, 0.4, V(70), 0.2]), { mat: "seam", soft: 0.001 });
      sc.paint(S.custom((x, y, z) => Math.max(Math.abs(y - sq[0]) + Math.abs(z - sq[1]) - V(1), V(25) - s * x), [-0.4, V(50), -0.2, 0.4, V(70), 0.2]), { mat: "stoneL", soft: 0.001 });
      // ---- arm: upper block, a two-block forearm, a huge block fist with knuckled fingers and a thumb
      blk("arm" + n, Fa, a.S, [0, V(9), 0], [V(4), V(5), V(4)], { r: V(0.8), mat: "stoneD" });
      blk("fore" + n, Ff, a.E, [0, V(3), 0], [V(5), V(3), V(5)], { r: V(1.2) });
      blk("fore" + n, Ff, a.E, [0, V(9.5), 0], [V(6), V(3.5), V(6)], { r: V(1.5), mat: "stoneL" });
      blk("hand" + n, Ff, a.W, [0, V(6), 0], [V(7), V(6), V(7)], { r: V(1.8) });
      for (const x of [5, 2, -1, -4]) blk("hand" + n, Ff, a.W, [s * V(x), V(8.5), V(-7)], [V(1), V(3.5), V(1)], { r: V(0.3), mat: "stoneD" });
      blk("hand" + n, Ff, a.W, [-s * V(7), V(5.5), V(-3.5)], [V(1), V(2.5), V(2.5)], { r: V(0.4), mat: "stoneD" });
      // ---- leg: thigh block, a bulky shin with a knee plate, a big flat foot
      blk("thigh" + n, WORLD, O0, [s * V(7), V(23), V(-1)], [V(4.5), V(7), V(5)], { r: V(1), mat: "stoneD" });
      blk("shin" + n, WORLD, O0, [s * V(7.5), V(10), V(0.5)], [V(5.5), V(6), V(6.5)], { r: V(1.5) });
      blk("shin" + n, WORLD, O0, [s * V(7), V(15.5), V(6.5)], [V(4), V(2.5), V(1.5)], { r: V(0.6), mat: "stoneL" });
      blk("foot" + n, WORLD, O0, [s * V(8), V(2.5), V(2.5)], [V(6), V(2.5), V(8.5)], { r: V(1), mat: "stoneD" });
    }
    return { sc, P, kind: "humanoid", props: [] };
  }

  // posture over the shared humanoid clips. Stone does not flex: the torso blocks keep together (the spine and chest
  // turns are folded into the pelvis, so no seams open between them) and the legs stand rigid; the heavy forearms
  // hang with a slight bend, the fists clear of the hips.
  function settle(fig, C) {
    const J = fig.J;
    J.root.quaternion.multiply(J.spine.quaternion).multiply(J.chest.quaternion);
    J.spine.quaternion.identity(); J.chest.quaternion.identity();
    for (const b of ["thighL", "thighR", "shinL", "shinR", "footL", "footR"]) J[b].quaternion.identity();
    C.rot(fig, "foreL", -0.22, 0, 0); C.rot(fig, "foreR", -0.42, 0.08, 0);
    C.addRot(fig, "armL", 0, 0, 0.07); C.addRot(fig, "armR", 0, 0, -0.07);
  }
  // turn a bone level with the figure (soles flat on the ground)
  function level(fig, name, amt) {
    const o = fig.J[name]; if (!o || amt <= 0) return;
    fig.root.updateMatrixWorld(true);
    const q = o.parent.getWorldQuaternion(o.quaternion.clone()).invert().multiply(fig.root.getWorldQuaternion(o.quaternion.clone()));
    o.quaternion.slerp(q, amt);
  }

  const HIT = 0.48, LEN = 1.25;
  return {
    cards: ["golem"], kind: "humanoid", build: golem, scale: 1.2,
    moves: { attack: { clip: "slam", hit: HIT, length: LEN, style: "blunt" } },
    pose(fig, clip, t, T, C) {
      const pulse = 0.1 + 0.08 * Math.sin(T * 2.2);
      if (clip !== "attack") {
        const r = C.base(fig, clip, t, T);
        settle(fig, C);
        C.emitBoost(fig, pulse);
        return r;
      }
      const { addRot, ik, toW, toM, wpos, bump, V3 } = C, P = fig.char.P, e = (a, b) => sstep(a, b, t);
      C.base(fig, "idle", 0, T);
      settle(fig, C);
      // wind-up: rise, arch back, both fists overhead (0-0.34) → slam: drop into a wide squat, bow, fists to the
      // ground in front (0.34-0.48) → hold with an impact shudder and a rune flare (→0.72) → recover (→1.15)
      const raise = e(0.02, 0.3) * (1 - e(0.34, 0.46));
      const slam = e(0.36, HIT) * (1 - e(0.72, 1.15));
      const shud = t > HIT ? Math.sin((t - HIT) * 70) * Math.exp(-(t - HIT) * 9) : 0;
      const flare = bump(HIT - 0.03, HIT + 0.01, 0.62, 0.95, t);
      // layered on the idle (additive), so the clip leaves and returns to it without a pop
      const J = fig.J;
      J.root.position.y += 0.014 * raise - 0.08 * slam - 0.008 * shud; J.root.position.z += -0.02 * raise + 0.035 * slam;
      addRot(fig, "root", -0.27 * raise + 0.62 * slam, 0, 0);
      addRot(fig, "neck", 0.04 * raise - 0.2 * slam, 0, 0);
      addRot(fig, "head", 0.08 * raise - 0.24 * slam, 0, 0);
      fig.root.updateMatrixWorld(true);
      // feet stay planted: legs by IK to their rest ankles, knees splaying out, soles level
      const legAmt = e(0, 0.06) * (1 - e(1.1, 1.22));
      for (const s of [1, -1]) {
        const n = sideName(s), A = V3(s * P.ankX, P.ankY, -0.006);
        ik(fig, "thigh" + n, "shin" + n, "foot" + n, toW(fig, A), toW(fig, V3(s * 0.9, P.kneeY, 0.6)), legAmt);
        level(fig, "foot" + n, legAmt);
      }
      // arms swing on an arc about each shoulder: φ from straight up (0) over the front to straight down (π)
      const hang = Math.PI - 0.1, up = -0.42, down = 2.62;
      let phi, rr;
      if (t < 0.34) { const u = e(0.02, 0.32); phi = mix(hang, up, u); rr = mix(0.97, 0.8, u); }
      else if (t < HIT) { const u = clamp((t - 0.34) / (HIT - 0.34), 0, 1), a = u * u; phi = mix(up, down, a); rr = mix(0.8, 0.99, a); }
      else { const u = e(0.72, 1.12); phi = mix(down, hang, u); rr = 0.97 + 0.02 * (1 - u); }
      const armAmt = e(0, 0.08) * (1 - e(1.02, 1.2)), conv = e(0.04, 0.3) * (1 - e(0.78, 1.1));
      for (const s of [1, -1]) {
        const n = sideName(s);
        fig.root.updateMatrixWorld(true);
        const Sm = toM(fig, wpos(fig.J["arm" + n]));
        const reach = (P.upArm + P.foreArm) * rr, xT = mix(Sm.x + s * 0.03, s * 0.1, conv), dx = xT - Sm.x;
        const L = Math.sqrt(Math.max(1e-6, reach * reach - dx * dx));
        const target = V3(xT, Sm.y + L * Math.cos(phi) - 0.006 * shud, Sm.z + L * Math.sin(phi));
        ik(fig, "arm" + n, "fore" + n, "hand" + n, toW(fig, target), toW(fig, V3(Sm.x + s * 0.5, Sm.y + 0.05, Sm.z - 0.05)), armAmt);
      }
      C.emitBoost(fig, pulse + 1.7 * flare);
      return t < LEN;
    },
  };
})());
