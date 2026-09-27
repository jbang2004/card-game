/* 荆棘树灵 — the thorn spirit (card thorn): a living thorny vine, a thick twisting stalk rising out of a mossy rock and
 * curling over at the top like a head, whip-like tendrils, golden-tipped thorns. It stands as its realistic model
 * (EmberModelFigures; tools/beast_prep.cjs bends it along a chain of stalk bones by height); this sculpt is for when
 * models are off. It sways at rest in a slow wave up the stalk, coils back and lashes down at a foe, recoils when
 * struck, and shivers upright when its side wins. */
EmberVoxelKit.define("thorn", (() => {
  const K = EmberVoxelKit;
  const { S, Sculpture, CLS, mats, spline, mix } = K;
  // the stalk: the rock (root) and four joints up it; the model's chain (weights by height) and every move
  const STALK = [["root", null, 0.1], ["s1", "root", 0.16], ["s2", "s1", 0.27], ["s3", "s2", 0.38], ["s4", "s3", 0.48]];
  function build() {
    const sc = new Sculpture();
    for (const [nm, par, y] of STALK) sc.bone(nm, par, 0, y, 0);
    mats(sc, {
      rock: { c: 0x6f7066, rough: 0.9, cls: CLS.skin, vary: 0.06 }, moss: { c: 0x5f8a2a, rough: 0.9, cls: CLS.plant },
      vine: { c: 0x2f7a2c, rough: 0.7, cls: CLS.plant, vary: 0.05 }, thorn: { c: 0xe0c050, rough: 0.5, cls: CLS.skin },
    });
    sc.add(S.ell(0.13, 0.07, 0.12), { mat: "rock", p: [0, 0.05, 0], bone: "root", k: 0.02 });
    sc.add(S.ell(0.1, 0.03, 0.09), { mat: "moss", p: [0, 0.1, 0], bone: "root", k: 0.02 });
    const pts = spline([[0, 0.08, 0], [0.02, 0.2, -0.01], [-0.02, 0.33, 0.01], [0.01, 0.45, 0.03], [0.02, 0.52, 0.08], [0.01, 0.5, 0.13]], 20)
      .map((p, i) => [...p, mix(0.035, 0.008, i / 20)]);
    const boneAt = (y) => (y < 0.16 ? "root" : y < 0.27 ? "s1" : y < 0.38 ? "s2" : y < 0.48 ? "s3" : "s4");
    for (let j = 0; j < 20; j += 4) sc.add(S.chain(pts.slice(j, j + 5)), { mat: "vine", p: [0, 0, 0], bone: boneAt(pts[j][1]), k: 0.004 });
    for (let j = 2; j < 18; j += 2) { const p = pts[j], a = j * 2.1; sc.limb(p.slice(0, 3), [p[0] + Math.cos(a) * 0.05, p[1] + 0.02, p[2] + Math.sin(a) * 0.05], 0.008, 0.0015, { mat: "thorn", bone: boneAt(p[1]), k: 0.003 }); }
    // two tendrils curling off the stalk, and broad leaves
    for (const sx of [1, -1]) {
      const t = spline([[0.01 * sx, 0.18, 0], [0.08 * sx, 0.26, 0.02], [0.12 * sx, 0.36, -0.01], [0.09 * sx, 0.42, -0.04]], 10).map((p, i) => [...p, mix(0.018, 0.005, i / 10)]);
      for (let j = 0; j < 10; j += 5) sc.add(S.chain(t.slice(j, j + 6)), { mat: "vine", p: [0, 0, 0], bone: boneAt(t[j][1]), k: 0.004 });
      sc.add(S.ell(0.045, 0.012, 0.022), { mat: "vine", p: [0.06 * sx, 0.22, 0.03], r: [0.3, 0, sx * 0.6], bone: "s1", k: 0.004 });
      sc.add(S.ell(0.04, 0.01, 0.02), { mat: "vine", p: [-0.05 * sx, 0.34, -0.02], r: [-0.2, 0, -sx * 0.5], bone: "s2", k: 0.004 });
    }
    return { sc, kind: "plant", props: [] };
  }
  function pose(fig, clip, t, T, C) {
    const { rot, sstep, bump } = C;
    let coil = 0, shake = 0, up = 0, done = true;
    if (clip === "attack") {
      // coil back (0-0.3) → lash down at the foe (0.3-0.45, the tip last) → the whip rings out and settles
      coil = bump(0, 0.26, 0.3, 0.4, t); done = t < 1.1;
    } else if (clip === "hurt") { shake = Math.exp(-t * 6) * sstep(0, 0.04, t); done = t < 0.6; }
    else if (clip === "victory") { up = bump(0, 0.25, 1.1, 1.5, t); done = t < 1.6; }
    STALK.slice(1).forEach(([nm], i) => {
      const k = (i + 1) / 4, lag = i * 0.025;
      const l = clip === "attack" ? bump(0.3 + lag, 0.45, 0.55 + lag, 1.0, t) : 0;
      const ring = clip === "attack" ? 0.12 * Math.sin((t - 0.45) * 26 - i) * bump(0.45, 0.5, 0.6, 1.0, t) : 0;
      rot(fig, nm, 0.07 * Math.sin(T * 1.3 - i * 0.6) - 0.32 * coil * k + 0.5 * l * (0.6 + k) + ring - 0.25 * shake * Math.sin(t * 40 + i) - 0.08 * up,
        0.05 * Math.sin(T * 0.7 - i * 0.4) + 0.15 * up * Math.sin(t * 18 - i), 0.05 * Math.sin(T * 0.9 - i * 0.5) + 0.12 * shake * Math.sin(t * 50 - i));
    });
    return done;
  }
  return { cards: ["thorn"], kind: "plant", build, pose, scale: 1.1,
    moves: { attack: { clip: "lash", style: "slash", hit: 0.45, length: 1.1, reach: 0.3, tint: 0x9be05a } } };
})());
