/* 赤岩狂战士 — Red Rock Berserker (card berserker): a red-bearded barbarian who cleaves with a molten battle axe.
 * He stands as his realistic model (EmberModelFigures); this sculpt, for when models are off, borrows the frost
 * king's swordsman. */
EmberVoxelKit.define("berserker", (() => {
  const B = EmberVoxelKit.get("frostking");
  return { cards: ["berserker"], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: 1.1, face: B.face,   // a big man, but not the frost king's 1.35
    moves: { attack: { ...B.moves.attack, tint: 0xff6a2a } } };
})());
