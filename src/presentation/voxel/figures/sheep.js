/* 绵羊 — the sheep (card sheep: what a polymorph leaves): a round, soft white fleece on four thin dark legs, a cream face
 * with drooping ears. It stands as its realistic model (EmberModelFigures, rigged by tools/beast_prep.cjs on the pup's
 * skeleton); this sculpt, for when models are off, is the pup's. Its moves are its own: it chews and flicks an ear at
 * rest, butts with its head down (backs up, trots in, bonk), and hops twice with a bleat when its side wins. */
EmberVoxelKit.define("sheep", (() => {
  const B = EmberVoxelKit.get("pup");
  function pose(fig, clip, t, T, C) {
    const { rot, off, sstep, bump } = C;
    const r = C.base(fig, clip === "hurt" ? "hurt" : "idle", clip === "hurt" ? t : 0, T);
    // a sheep's tail flicks quick and short; it chews now and then
    rot(fig, "tail1", 0.2, 0.25 * Math.sin(T * 9), 0); rot(fig, "tail2", 0, 0, 0); rot(fig, "tail3", 0, 0, 0);
    const chew = bump(0, 0.2, 2.2, 2.5, (T + 1.3) % 7.5);
    rot(fig, "jaw", 0.06 * chew * (0.5 + 0.5 * Math.sin(T * 11)), 0.03 * chew * Math.sin(T * 5.5), 0);
    if (clip === "attack") {
      // back up with the head lowered (0-0.3), trot in (0.3-0.45), the butt at 0.45, bounce back off it
      const back = bump(0, 0.22, 0.28, 0.36, t), run = bump(0.28, 0.42, 0.5, 0.75, t), bonk = bump(0.42, 0.45, 0.5, 0.62, t);
      const trot = Math.sin(clamp((t - 0.28) / 0.17, 0, 1) * Math.PI * 2);
      off(fig, "root", 0, 0.012 * Math.abs(trot) * run, -0.04 * back + 0.08 * run - 0.03 * bonk);
      rot(fig, "root", 0.1 * back + 0.05 * run, 0, 0);
      rot(fig, "neck", 0.45 * back + 0.55 * run, 0, 0);
      rot(fig, "head", 0.3 * back + 0.35 * run - 0.2 * bonk, 0, 0.05 * trot * run);
      for (const s of ["L", "R"]) {
        const ph = s === "L" ? 1 : -1;
        rot(fig, "scap" + s, -0.35 * run * trot * ph + 0.15 * back, 0, 0); rot(fig, "elb" + s, 0.3 * back + 0.25 * run * Math.max(0, trot * ph), 0, 0);
        rot(fig, "hip" + s, 0.35 * run * trot * ph - 0.2 * back, 0, 0); rot(fig, "stif" + s, -0.25 * back, 0, 0);
        rot(fig, "ear" + s, -0.4 * run, 0, 0);
      }
      return t < 1.0;
    }
    if (clip === "victory") {
      // two hops, a bleat with the head up
      const h1 = Math.max(0, Math.sin(clamp(t / 0.32, 0, 1) * Math.PI)), h2 = Math.max(0, Math.sin(clamp((t - 0.38) / 0.32, 0, 1) * Math.PI));
      off(fig, "root", 0, 0.05 * (h1 + h2), 0);
      const baa = bump(0.75, 0.85, 1.25, 1.45, t);
      rot(fig, "neck", -0.35 * baa, 0, 0); rot(fig, "head", -0.25 * baa, 0, 0); rot(fig, "jaw", 0.35 * baa * (0.7 + 0.3 * Math.sin(t * 30)), 0, 0);
      for (const s of ["L", "R"]) { rot(fig, "scap" + s, -0.3 * (h1 + h2), 0, 0); rot(fig, "hip" + s, 0.3 * (h1 + h2), 0, 0); rot(fig, "ear" + s, 0.3 * baa, 0, 0); }
      return t < 1.6;
    }
    return r;
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  return { cards: ["sheep"], kind: "quadruped", fam: B.fam, build: B.build, pose, scale: 1.1, face: B.face,
    moves: { attack: { clip: "butt", style: "blunt", hit: 0.45, length: 1.0, reach: 0.22 } } };
})());
