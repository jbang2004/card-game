/* 曙光祭司 — Dawn Priestess (card cleric): a priestess in white and gold robes who lifts a sun of holy light in her
 * right hand and casts it. She stands as her realistic model (EmberModelFigures); this sculpt, for when models are
 * off, borrows the fire apprentice's, its bolt tinted gold. */
EmberVoxelKit.define("cleric", (() => {
  const B = EmberVoxelKit.get("spark");
  return { cards: ["cleric"], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: 1.0, face: B.face,
    moves: { attack: { ...B.moves.attack, fire: false, tint: 0xffd070 } } };      // holy light, not the apprentice's fire
})());
