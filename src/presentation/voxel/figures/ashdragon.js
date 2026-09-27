/* 终焰·阿什拉 — Ashra, the Last Flame (card ashdragon; the dragon boss stands as it too): a colossal obsidian dragon,
 * lava glowing in the cracks of its scales, great horns, wings half spread. It stands as its realistic model
 * (EmberModelFigures, rigged by tools/beast_prep.cjs on the whelp's skeleton); this sculpt, for when models are off, is
 * the Emberthroat whelp's. Its breath is the whelp's, drawn out: it rears, fills its chest, and pours fire. */
EmberVoxelKit.define("ashdragon", (() => {
  const B = EmberVoxelKit.get("dragon");
  return { cards: ["ashdragon"], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: 1.55, face: B.face,
    moves: { attack: { ...B.moves.attack, tint: 0xff7a2a, windup: 480 } } };     // (it draws its breath a long moment)
})());
