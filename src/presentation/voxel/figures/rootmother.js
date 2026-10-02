/* 根母 — the Root Mother, a guardian spirit of braided roots (boss portrait rootmother; boss id queen).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/rootmother.glb); this sculpt, for when
 * models are off, borrows the oracle's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("rootmother", (() => {
  const B = EmberVoxelKit.get("oracle");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
