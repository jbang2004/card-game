/* 利奥尔 · 提灯人 — Liol, the lamplighter (hero portrait liol): a night-shift guide of the moon-temple order with a miner's lantern.
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/liol.glb); this sculpt, for when
 * models are off, borrows the soulguide's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("liol", (() => {
  const B = EmberVoxelKit.get("soulguide");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
