/* 玄铁泰坦 — Iron Titan (card titan): a towering construct of black iron plates riveted over glowing seams, who
 * crushes foes with both fists. He stands as his realistic model (EmberModelFigures); this sculpt, for when models
 * are off, borrows the rune golem's. */
EmberVoxelKit.define("titan", (() => {
  const B = EmberVoxelKit.get("golem");
  return { cards: ["titan"], kind: B.kind, build: B.build, pose: B.pose, scale: 1.3, moves: B.moves };
})());
