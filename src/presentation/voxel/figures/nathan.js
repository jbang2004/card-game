/* 点火者·纳坦 — Natan Brandt, the Igniter (boss portrait nathan; boss id dragon).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/nathan.glb); this sculpt, for when
 * models are off, borrows the necromancer's (he strikes from where he stands: 点火). It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("nathan", (() => {
  const B = EmberVoxelKit.get("necromancer");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
