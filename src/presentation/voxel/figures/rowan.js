/* 罗温 · 守林人 — Rowan, the last forester (hero portrait rowan): a village hunter with a plain wooden bow.
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/rowan.glb); this sculpt, for when
 * models are off, borrows the vesper's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("rowan", (() => {
  const B = EmberVoxelKit.get("vesper");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
