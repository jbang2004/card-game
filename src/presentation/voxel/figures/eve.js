/* 伊芙 — Eve of the other side (boss portrait eve; docs/design/CAST_V2.md): the last of the expedition.
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/eve.glb); this sculpt, for when
 * models are off, borrows the cleric's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("eve", (() => {
  const B = EmberVoxelKit.get("cleric");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
