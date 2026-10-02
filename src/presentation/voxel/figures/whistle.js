/* 铁哨 — Ironwhistle, the mine foreman (boss portrait whistle; boss id warden).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/whistle.glb); this sculpt, for when
 * models are off, borrows the frostking's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("whistle", (() => {
  const B = EmberVoxelKit.get("frostking");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
