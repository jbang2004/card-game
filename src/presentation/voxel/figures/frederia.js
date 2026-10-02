/* 菲德莉亚 · 背誓骑士 — Frederia, the oath-breaker (hero portrait frederia): a former bodyguard with a scuffed wooden shield.
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/frederia.glb); this sculpt, for when
 * models are off, borrows the paladin's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("frederia", (() => {
  const B = EmberVoxelKit.get("paladin");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
