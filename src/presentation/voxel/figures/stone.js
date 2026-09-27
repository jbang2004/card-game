/* 石卫 — the stone ward (card stone): a floating rune monolith, a shield-shaped slab of grey granite pointed at both
 * ends, a carved frame round a glowing sky-blue crystal. It stands as its realistic model (EmberModelFigures, one rigid
 * bone: tools/beast_prep.cjs); this sculpt is for when models are off. It has no limbs, so all its moves are the slab's
 * own: it hovers and turns slowly at rest, rears back and slams its face down on a foe, shudders when struck, and
 * spins up into the air when its side wins. */
EmberVoxelKit.define("stone", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, CLS, mats } = K;
  const C0 = [0, 0.32, 0];                                       // the slab's middle: its one bone, the pivot of every move
  function build() {
    const sc = new Sculpture();
    sc.bone("root", null, ...C0);
    mats(sc, {
      granite: { c: 0x8a8d94, rough: 0.85, cls: CLS.skin, vary: 0.06 }, frame: { c: 0xc4c8d0, rough: 0.6, cls: CLS.skin },
      crystal: { c: 0x4aa8ff, rough: 0.2, emit: 0.5, cls: CLS.glow },
    });
    // the slab: a lozenge pointed top and bottom, thin front to back
    const slab = S.custom((x, y, z) => Math.max(Math.abs(x) / 0.13 + Math.abs(y) / 0.3 - 1, Math.abs(z) - 0.035) * 0.1, [-0.13, -0.3, -0.035, 0.13, 0.3, 0.035]);
    sc.add(slab, { mat: "granite", p: C0, bone: "root", k: 0.004 });
    sc.add(S.ell(0.06, 0.1, 0.012), { mat: "frame", p: [C0[0], C0[1], 0.03], bone: "root", k: 0.004 });
    sc.add(S.ell(0.035, 0.06, 0.02), { mat: "crystal", p: [C0[0], C0[1], 0.038], bone: "root", k: 0.004 });
    // the carved frame's arms above and below the crystal, and shards of the slab floating round it
    for (const sy of [1, -1]) sc.add(S.box(0.012, 0.07, 0.01), { mat: "frame", p: [0, C0[1] + sy * 0.15, 0.03], bone: "root", k: 0.003 });
    for (let i = 0; i < 10; i++) {
      const a = i * 0.9 + 0.4, r = 0.17 + 0.03 * (i % 3), y = C0[1] - 0.24 + 0.053 * i;
      sc.add(S.ell(0.026 + 0.008 * (i % 2), 0.022, 0.024), { mat: "granite", p: [Math.cos(a) * r, y, Math.sin(a) * r * 0.6], r: [a, a * 0.7, 0], bone: "root", k: 0.004 });
    }
    return { sc, kind: "construct", props: [] };
  }
  function pose(fig, clip, t, T, C) {
    const { rot, off, sstep, bump } = C;
    const bob = 0.05 + 0.02 * Math.sin(T * 1.6);
    let x = 0, y = 0.4 * Math.sin(T * 0.45) * 0.3, z = 0.03 * Math.sin(T * 0.9), dy = bob, dz = 0, glow = 0.2 + 0.15 * Math.sin(T * 2.1), done = true;
    if (clip === "attack") {
      // rise and rear back (0-0.35) → slam its face down on the foe at 0.45 → settle back
      const rear = bump(0, 0.3, 0.36, 0.44, t), slam = bump(0.36, 0.45, 0.55, 0.95, t);
      x = -0.45 * rear + 0.75 * slam; dy += 0.08 * rear - 0.03 * slam; dz = -0.04 * rear + 0.12 * slam; y *= 1 - rear;
      glow += 1.2 * rear + 2 * bump(0.4, 0.45, 0.52, 0.8, t); done = t < 1.1;
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 7) * sstep(0, 0.04, t);
      z += 0.14 * k * Math.sin(t * 55); x -= 0.18 * k; dz -= 0.05 * k; done = t < 0.6;
    } else if (clip === "victory") {
      const up = bump(0, 0.3, 1.1, 1.5, t);
      y = 6.2832 * sstep(0.1, 1.1, t); dy += 0.1 * up; glow += 0.8 * up; done = t < 1.6;
    }
    rot(fig, "root", x, y, z); off(fig, "root", 0, dy, dz);
    C.emitBoost(fig, glow);
    return done;
  }
  return { cards: ["stone"], kind: "construct", build, pose, scale: 1.1,
    moves: { attack: { clip: "slam", style: "blunt", hit: 0.45, length: 1.1, reach: 0.24, tint: 0x7cc4ff } } };
})());
