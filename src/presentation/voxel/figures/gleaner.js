/* gleaner — a boss of the amber story (content/portraits.js; docs/design/CAST_V2.md).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/gleaner.glb); this sculpt, for when
 * models are off, borrows the necromancer's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("gleaner", (() => {
  const B = EmberVoxelKit.get("necromancer");
  // (a scavenger with a crowbar: it strikes hand to hand — the borrowed sculpt's clip, but no bolt and no wind-up of a caster)
  const A = B.moves.attack;
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: { attack: { clip: A.clip, hit: A.hit, length: A.length, style: "blunt" } } };
})());
