/* 远古山岳 — Ancient Colossus (card colossus): a mountain given a body, mossy crags for shoulders and trees on its
 * back, who brings both fists down like a landslide. He stands as his realistic model (EmberModelFigures); this
 * sculpt, for when models are off, borrows the rune golem's. */
EmberVoxelKit.define("colossus", (() => {
  const B = EmberVoxelKit.get("golem");
  return { cards: ["colossus"], kind: B.kind, build: B.build, pose: B.pose, scale: 1.45, moves: B.moves };
})());
