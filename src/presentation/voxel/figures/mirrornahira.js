/* mirrornahira — the black-jade mirror of the hero nahira (boss portrait mirrornahira; docs/design/CAST_V2.md).
 * It stands as its realistic model (tools/models/figures/mirrornahira.glb, the hero's model regraded by tools/mirror_glb.py); this
 * sculpt, for when models are off, is the hero's own. It stands for no card. */
EmberVoxelKit.define("mirrornahira", (() => {
  const B = EmberVoxelKit.get("nahira");
  return { cards: [], kind: B.kind, fam: B.fam, build: B.build, pose: B.pose, scale: B.scale, face: B.face, moves: B.moves };
})());
