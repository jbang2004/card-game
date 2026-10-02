/* 译者 — the Translator, scholar of the Root-Sea Notes (boss portrait translator; boss id oracle).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/translator.glb); this sculpt, for when
 * models are off, borrows the necromancer's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("translator", (() => {
  const B = EmberVoxelKit.get("necromancer");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
