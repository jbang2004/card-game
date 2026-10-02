/* 早醒者 — the Early Riser, a primeval tusked beast cracked out of amber (boss portrait earlyriser).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/earlyriser.glb); this sculpt, for when
 * models are off, borrows the wolf's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("earlyriser", (() => {
  const B = EmberVoxelKit.get("wolf");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
