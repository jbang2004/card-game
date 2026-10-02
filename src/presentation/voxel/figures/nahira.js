/* 娜希拉 · 鉴珀师 — Nahira, the amber reader (hero portrait nahira): a registry clerk in a blue-grey work coat with a brass loupe.
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/nahira.glb); this sculpt, for when
 * models are off, borrows the oracle's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("nahira", (() => {
  const B = EmberVoxelKit.get("oracle");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
