/* 守根人 — the Root Keeper, a frost-rimed war hero of the Root War (boss portrait rootkeeper; boss id frost).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/rootkeeper.glb); this sculpt, for when
 * models are off, borrows the frostking's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("rootkeeper", (() => {
  const B = EmberVoxelKit.get("frostking");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
