/* amberbody — a boss of the amber story (content/portraits.js; docs/design/CAST_V2.md).
 * It stands as its realistic model (EmberModelFigures, from tools/models/figures/amberbody.glb); this sculpt, for when
 * models are off, borrows the paladin's. It stands for no card: content/portraits.js names it as the portrait's `figure`. */
EmberVoxelKit.define("amberbody", (() => {
  const B = EmberVoxelKit.get("paladin");
  // (the knight's sword of light is hers alone: no judgment falls with this one's heavy blows)
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: { attack: { ...B.moves.attack, smite: false } } };
})());
