/* clockmaker — a boss of the amber story (content/portraits.js; docs/design/CAST_V2.md).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/clockmaker.glb); this sculpt, for when
 * models are off, borrows the soulguide's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("clockmaker", (() => {
  const B = EmberVoxelKit.get("soulguide");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
