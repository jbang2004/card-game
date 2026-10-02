/* 守灯之兽 — the Lamp Beast, a white lion-wolf that carries the old lantern (boss portrait lampbeast; boss id moonkeeper).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/lampbeast.glb); this sculpt, for when
 * models are off, borrows the wolf's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("lampbeast", (() => {
  const B = EmberVoxelKit.get("wolf");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
