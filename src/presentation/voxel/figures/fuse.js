/* fuse — a boss of the amber story (content/portraits.js; docs/design/CAST_V2.md).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/fuse.glb); this sculpt, for when
 * models are off, borrows the vesper's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("fuse", (() => {
  const B = EmberVoxelKit.get("vesper");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
