/* 曙光新兵 — Dawn Recruit (card recruit): a young knight in silver plate with a short sword and a round sun shield.
 * She stands as her realistic model (EmberModelFigures); this sculpt, for when models are off, borrows the dawn
 * squire's. */
EmberVoxelKit.define("recruit", (() => {
  const B = EmberVoxelKit.get("squire");
  return { cards: ["recruit"], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: 0.9, face: B.face,
    moves: { attack: { ...B.moves.attack } } };
})());
