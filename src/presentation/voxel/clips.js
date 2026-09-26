/* EmberVoxelClips — the shared motion library for voxel figures (skeletons from
 * EmberVoxelKit). Clips are functions of time layered over the bind pose; "idle" loops,
 * the others run once. Arms use a two-bone IK and props a grip solver, so one clip fits
 * every humanoid. Attacks go toward the figure's +Z (humanoids) / +Z (quadrupeds); the
 * figure's moves.attack.clip picks the attack, and HIT[clip] is the contact time the
 * stage lines up with the director's contact beat. A figure with its own skeleton
 * (spider, bird, …) passes its own spec.pose(fig, clip, t, T, C) and uses the helpers.
 *   humanoid : idle · attack (spear lunge / bow shot with a flying arrow) · hurt · victory
 *   quadruped: idle · attack (bite: pounce and bite / gore: rear, charge, glow) · hurt */
const EmberVoxelClips = (() => {
  const THREE = EmberVesperThree;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const bump = (a, b, c, d, t) => sstep(a, b, t) * (1 - sstep(c, d, t));
  const E = new THREE.Euler(), Q = new THREE.Quaternion();
  const LENGTH = { idle: Infinity, attack: 1.3, hurt: 0.6, victory: 1.6 };
  /** contact time (s) of each attack clip — the stage warps the clip so this lands on the director's contact */
  const HIT = { spear: 0.4, bow: 0.62, bite: 0.42, gore: 0.5 };
  const attackOf = (fig) => (fig.spec && fig.spec.moves && fig.spec.moves.attack && fig.spec.moves.attack.clip) || "strike";
  const setFace = (fig, e) => EmberVoxelRender.setFace(fig, e);

  function rot(fig, name, x, y, z) { const o = fig.J[name]; if (!o) return; const r = fig.rest.get(o); E.set(x, y, z); o.quaternion.copy(r.q).multiply(Q.setFromEuler(E)); }
  function addRot(fig, name, x, y, z) { const o = fig.J[name]; if (!o) return; E.set(x, y, z); o.quaternion.multiply(Q.setFromEuler(E)); }
  function off(fig, name, x, y, z) { const o = fig.J[name]; if (!o) return; const r = fig.rest.get(o); o.position.set(r.p.x + x, r.p.y + y, r.p.z + z); }
  const wpos = (o) => o.getWorldPosition(V3());
  // model space (figure group) ↔ world
  const toW = (fig, p) => fig.root.localToWorld(p.clone());
  const toM = (fig, p) => fig.root.worldToLocal(p.clone());
  const dirW = (fig, d) => d.clone().applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion())).normalize();

  function turnBone(bone, from, to) {
    if (from.lengthSq() < 1e-12 || to.lengthSq() < 1e-12) return;
    const q = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
    const wq = bone.getWorldQuaternion(new THREE.Quaternion());
    const pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(pq.invert().multiply(q.multiply(wq)));
    bone.updateMatrixWorld(true);
  }
  /* two-bone IK: place `end` at world target T, elbow/knee toward world pole */
  function ik(fig, upper, lower, end, T, pole, amount = 1) {
    const a = fig.J[upper], b = fig.J[lower], c = fig.J[end];
    if (!a || !b || !c || amount <= 0) return;
    fig.root.updateMatrixWorld(true);
    const A = wpos(a), B = wpos(b), C = wpos(c);
    const l1 = A.distanceTo(B), l2 = B.distanceTo(C);
    const target = C.clone().lerp(T, amount);
    const d = clamp(A.distanceTo(target), 1e-4, (l1 + l2) * 0.999);
    const dir = target.clone().sub(A).normalize();
    const pv = pole.clone().sub(A); pv.addScaledVector(dir, -pv.dot(dir));
    if (pv.lengthSq() < 1e-10) pv.set(0, 0, 1); pv.normalize();
    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    const Bn = A.clone().addScaledVector(dir, l1 * cosA).addScaledVector(pv, l1 * sinA);
    turnBone(a, B.clone().sub(A), Bn.clone().sub(A));
    const B2 = wpos(b), C2 = wpos(c);
    turnBone(b, C2.clone().sub(B2), A.clone().addScaledVector(dir, d).sub(B2));
  }
  /* point a hand's prop: holder +Y along `dir` (model space), optional holder +Z toward `face` */
  function aimGrip(fig, hand, dir, face = null, amount = 1) {
    const pr = fig.props && fig.props.find((p) => p.bone === hand);
    const o = fig.J[hand];
    if (!pr || !o || amount <= 0) return;
    fig.root.updateMatrixWorld(true);
    const hq = o.getWorldQuaternion(new THREE.Quaternion());
    const holderW = hq.clone().multiply(pr.holder.quaternion);
    const y = V3(0, 1, 0).applyQuaternion(holderW), want = dirW(fig, V3(...dir));
    const q1 = new THREE.Quaternion().setFromUnitVectors(y, want);
    if (face) {
      // twist about `want` so the holder's +Z points as close to `face` as possible
      const z = V3(0, 0, 1).applyQuaternion(q1.clone().multiply(holderW));
      const f = dirW(fig, V3(...face)); f.addScaledVector(want, -f.dot(want));
      if (f.lengthSq() > 1e-8) {
        f.normalize(); z.addScaledVector(want, -z.dot(want)).normalize();
        const ang = Math.atan2(V3().crossVectors(z, f).dot(want), z.dot(f));
        q1.premultiply(new THREE.Quaternion().setFromAxisAngle(want, ang));
      }
    }
    if (amount < 1) q1.slerp(new THREE.Quaternion(), 1 - amount);
    const nq = q1.multiply(hq);
    const pq = o.parent.getWorldQuaternion(new THREE.Quaternion());
    o.quaternion.copy(pq.invert().multiply(nq));
    o.updateMatrixWorld(true);
  }
  function reset(fig) { for (const b of fig.bones) { const r = fig.rest.get(b); b.position.copy(r.p); b.quaternion.copy(r.q); } }

  // arrow for the bow shot (created lazily, shared material with the figure's props)
  function arrowOf(fig) {
    if (fig.arrow !== undefined) return fig.arrow;
    fig.arrow = null;
    const quiver = fig.props && fig.props.find((p) => p.grip === "back");
    if (!quiver) return null;
    const g = new THREE.Group();
    const L = 0.36;
    const mk = (geo, color, y) => {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
      m.position.y = y; g.add(m); return m;
    };
    mk(new THREE.CylinderGeometry(0.0022, 0.0022, L, 6), 0x7a5a38, L / 2);
    mk(new THREE.ConeGeometry(0.006, 0.022, 4), 0xd8dde2, L + 0.011);
    for (let i = 0; i < 3; i++) { const f = mk(new THREE.BoxGeometry(0.0012, 0.03, 0.009), i ? 0xe8e2d2 : 0x3f6b35, 0.03); f.rotation.y = (i * TAU) / 3; f.position.x = 0.004 * Math.cos((i * TAU) / 3); f.position.z = 0.004 * Math.sin((i * TAU) / 3); }
    // streak for the flight
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.0005, 0.004, 0.5, 6, 1, true), new THREE.MeshBasicMaterial({ color: 0xd8f0ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    tr.position.y = -0.25; g.add(tr); g.userData.trail = tr; g.userData.len = L;
    g.visible = false;
    fig.root.add(g);
    fig.arrow = g;
    return g;
  }
  function placeArrow(a, tailM, dirM) {
    a.position.copy(tailM);
    a.quaternion.setFromUnitVectors(V3(0, 1, 0), dirM.clone().normalize());
  }
  function emitBoost(fig, k) { EmberVoxelRender.setEmit(fig, 1 + k); }

  /* humanoid ------------------------------------------------------------ */
  function humanoid(fig, clip, t, T) {
    const P = fig.char.P, chib = fig.char.fam === "chibi", H = 1;
    const br = Math.sin((T * TAU) / 3.4), sway = Math.sin((T * TAU) / 5.3);
    const spear = attackOf(fig) === "spear";
    const armDown = P.abd - (chib ? 0.2 : 0.12);
    let face = "open";
    // idle base: weight shift, breathing, relaxed arms, weapon held upright
    rot(fig, "root", 0, 0.06 * sway, 0.02);
    off(fig, "root", 0.004 * sway, 0.003 * br, 0);
    rot(fig, "spine", 0.02 * br, -0.03 * sway, -0.015);
    rot(fig, "chest", 0.025 * br, -0.04 * sway, -0.01);
    rot(fig, "neck", -0.02, 0.05 * sway, 0);
    rot(fig, "head", 0.03 * Math.sin(T * 0.9) - 0.02, 0.1 * Math.sin(T * 0.43), 0.03 * Math.sin(T * 0.61));
    rot(fig, "thighL", 0, 0, -0.03); rot(fig, "thighR", 0, 0, 0.03);
    rot(fig, "shinL", 0.02, 0, 0); rot(fig, "shinR", 0.08, 0, 0);
    rot(fig, "footL", -0.02, 0, 0.03); rot(fig, "footR", -0.08, 0, -0.03);
    rot(fig, "armL", -0.12, 0, -armDown + 0.03 * br);
    rot(fig, "foreL", spear ? -0.35 : -0.95, spear ? 0 : 0.35, 0);
    rot(fig, "armR", spear ? -0.25 : -0.05, 0, armDown - (spear ? 0.08 : 0) - 0.03 * br);
    rot(fig, "foreR", spear ? -1.15 : -0.3, spear ? -0.3 : 0, 0);
    for (const s of ["L", "R"]) { rot(fig, "cape1" + s, 0.06 + 0.04 * Math.sin(T * 1.3 + (s === "L" ? 0 : 1)), 0, 0); rot(fig, "cape2" + s, 0.05 * Math.sin(T * 1.7 + 0.5), 0, 0.03 * Math.sin(T * 1.1)); }
    rot(fig, "hairB1", 0.04 * Math.sin(T * 1.2), 0, 0.03 * Math.sin(T * 0.9)); rot(fig, "hairB2", 0.05 * Math.sin(T * 1.4 + 0.6), 0, 0);
    rot(fig, "hairL", 0.03 * Math.sin(T * 1.1), 0, 0.02 * Math.sin(T * 1.3)); rot(fig, "hairR", 0.03 * Math.sin(T * 1.2 + 1), 0, -0.02 * Math.sin(T * 1.4));
    if (Math.sin(T * 1.7) > 0.985) face = "closed";
    fig.root.updateMatrixWorld(true);
    let idleGrip = 1;
    const arrow = !spear ? arrowOf(fig) : null;
    if (arrow) arrow.visible = false;

    if (clip === "attack" && spear) {
      // coil (0-0.3) → lunge and thrust (0.3-0.42) → hold (→0.62) → recover (→1.1)
      const wind = bump(0, 0.28, 0.3, 0.4, t), th = bump(0.3, 0.42, 0.62, 1.05, t), shake = th * Math.sin(t * 90) * 0.004 * (1 - sstep(0.42, 0.6, t));
      rot(fig, "root", 0.05 * th, 0.55 * wind - 0.3 * th, 0);
      off(fig, "root", 0, (-0.04 * wind - 0.05 * th) * H, (-0.04 * wind + 0.1 * th) * H);
      rot(fig, "spine", 0.12 * th - 0.06 * wind, 0.15 * wind - 0.15 * th, 0);
      rot(fig, "chest", 0.1 * th, 0.25 * wind - 0.25 * th, 0);
      rot(fig, "head", -0.05 * th, -0.4 * wind + 0.3 * th, 0);
      rot(fig, "thighL", -0.75 * th - 0.25 * wind, 0, -0.05); rot(fig, "shinL", 0.55 * th + 0.35 * wind, 0, 0); rot(fig, "footL", 0.2 * th, 0, 0);
      rot(fig, "thighR", 0.45 * th + 0.15 * wind, 0, 0.05); rot(fig, "shinR", 0.3 * th + 0.25 * wind, 0, 0); rot(fig, "footR", -0.3 * th, 0, 0);
      fig.root.updateMatrixWorld(true);
      const shR = wpos(fig.J.armR), m = toM(fig, shR);
      const back = V3(m.x - 0.07, m.y - 0.16, m.z - 0.12), fwd = V3(m.x + 0.02, m.y - 0.02, m.z + (P.upArm + P.foreArm) * 0.95);
      const hand = back.clone().lerp(fwd, sstep(0.3, 0.42, t)).lerp(V3(m.x - 0.02, m.y - 0.25, m.z + 0.1), sstep(0.7, 1.05, t));
      const k = Math.max(wind, th);
      ik(fig, "armR", "foreR", "handR", toW(fig, hand.add(V3(0, shake, 0))), toW(fig, V3(m.x - 0.3, m.y - 0.2, m.z - 0.1)), k);
      const shL = toM(fig, wpos(fig.J.armL));
      ik(fig, "armL", "foreL", "handL", toW(fig, V3(shL.x - 0.08, shL.y - 0.12, shL.z + 0.22 * th + 0.05)), toW(fig, V3(shL.x + 0.3, shL.y - 0.2, shL.z)), k * 0.9);
      const aim = V3(0.02, 0.35 * wind - 0.05 * th, 1).normalize();
      aimGrip(fig, "handR", [aim.x, aim.y, aim.z], null, k);
      idleGrip = 1 - k;
      for (const s of ["L", "R"]) { rot(fig, "cape1" + s, 0.06 + 0.55 * th + 0.1 * wind, 0, 0); rot(fig, "cape2" + s, 0.45 * th, 0, 0); }
      rot(fig, "hairB1", 0.4 * th, 0, 0); rot(fig, "hairL", 0.3 * th, 0, 0); rot(fig, "hairR", 0.3 * th, 0, 0);
      face = t > 0.08 && t < 0.9 ? "fierce" : "open";
    } else if (clip === "attack") {
      // raise the bow (0-0.25) → draw to the cheek (0.2-0.55) → hold → release at 0.62 → follow-through → recover
      const up = sstep(0.0, 0.24, t) * (1 - sstep(0.95, 1.3, t));
      const draw = sstep(0.2, 0.55, t) * (1 - sstep(0.62, 0.64, t)), rel = bump(0.62, 0.66, 0.8, 1.1, t);
      rot(fig, "root", 0, -1.0 * up, 0);
      rot(fig, "spine", 0, -0.12 * up, 0);
      rot(fig, "chest", -0.04 * up, -0.2 * up, 0.04 * up);
      rot(fig, "neck", 0, 0.45 * up, 0); rot(fig, "head", -0.03 * up, 0.55 * up, 0.05 * up);
      rot(fig, "thighL", -0.08 * up, 0, -0.12 * up); rot(fig, "thighR", 0.06 * up, 0, 0.14 * up);
      fig.root.updateMatrixWorld(true);
      const D = V3(0, 0, 1);
      const shL = toM(fig, wpos(fig.J.armL)), reach = (P.upArm + P.foreArm) * 0.94;
      const bowHand = V3(shL.x * 0.4, shL.y + 0.01, shL.z + reach);
      ik(fig, "armL", "foreL", "handL", toW(fig, bowHand), toW(fig, V3(shL.x + 0.2, shL.y - 0.3, shL.z)), up);
      aimGrip(fig, "handL", [0.06, 1, -0.12], [0, 0, 1], up);
      const shR = toM(fig, wpos(fig.J.armR)), headM = toM(fig, wpos(fig.J.head));
      const anchor = V3(headM.x - 0.025 * (chib ? 3 : 1), headM.y + (chib ? 0.05 : 0.0), headM.z + (chib ? 0.06 : 0.02));
      const string = bowHand.clone().addScaledVector(D, -0.04);
      const drawHand = string.clone().lerp(anchor, draw).addScaledVector(D, -0.05 * rel).add(V3(-0.03 * rel, 0.02 * rel, 0));
      ik(fig, "armR", "foreR", "handR", toW(fig, drawHand), toW(fig, V3(shR.x - 0.3, shR.y + 0.15, shR.z - 0.25)), up);
      idleGrip = 1 - up;
      // arrow: nocked while drawing, flies straight along D after the release
      if (arrow) {
        const L = arrow.userData.len;
        if (t > 0.18 && t < 0.62) { arrow.visible = true; placeArrow(arrow, drawHand.clone().addScaledVector(D, -0.01), D); arrow.userData.trail.material.opacity = 0; }
        else if (t >= 0.62 && t < 0.95) { arrow.visible = true; const f = (t - 0.62) * 4.2; placeArrow(arrow, anchor.clone().addScaledVector(D, 0.1 + f), D); arrow.userData.trail.material.opacity = 0.7 * (1 - sstep(0.8, 0.95, t)); }
      }
      face = draw > 0.2 && t < 0.62 ? "focus" : rel > 0.1 ? "fierce" : "open";
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * sstep(0, 0.05, t);
      rot(fig, "spine", -0.25 * k, 0, 0.15 * k); rot(fig, "chest", -0.3 * k, 0, 0.1 * k); rot(fig, "head", -0.3 * k, 0.2 * k, 0.15 * k);
      addRot(fig, "armL", 0, 0, 0.5 * k); addRot(fig, "armR", 0, 0, -0.5 * k);
      off(fig, "root", 0, -0.02 * k, -0.05 * k);
      face = t < 0.45 ? "hurt" : "open";
    } else if (clip === "victory") {
      const up = bump(0, 0.3, 1.2, 1.6, t), bob = Math.sin(t * 9) * up * 0.2;
      rot(fig, "armR", -2.6 * up, 0, 0.2 * up); rot(fig, "foreR", -0.2 * up, 0, 0);
      rot(fig, "chest", -0.12 * up, 0.1 * up, 0); rot(fig, "head", -0.25 * up, 0, 0);
      off(fig, "root", 0, 0.02 * Math.abs(bob), 0);
      face = up > 0.3 ? "fierce" : "open";
    }
    fig.root.updateMatrixWorld(true);
    if (idleGrip > 0.001) {
      if (spear) aimGrip(fig, "handR", [-0.08, 1, 0.12 + 0.02 * br], null, idleGrip);
      else aimGrip(fig, "handL", [0.1, 1, 0.28], null, idleGrip);
    }
    setFace(fig, face);
    return t < (LENGTH[clip] ?? 1);
  }

  /* quadruped ----------------------------------------------------------- */
  function quadruped(fig, clip, t, T) {
    const stag = attackOf(fig) === "gore";
    const br = Math.sin((T * TAU) / (stag ? 3.2 : 1.8));
    let face = "open";
    rot(fig, "spine", 0.01 * br, 0, 0); rot(fig, "chest", 0.015 * br, 0, 0);
    rot(fig, "neck", (stag ? -0.05 : 0.04) + 0.02 * br, 0.08 * Math.sin(T * 0.5), 0);
    rot(fig, "head", 0.05 * Math.sin(T * 0.8), 0.18 * Math.sin(T * 0.37), 0.04 * Math.sin(T * 0.6));
    const wag = stag ? 2 : 6;
    rot(fig, "tail1", 0.1, 0.45 * Math.sin(T * wag), 0); rot(fig, "tail2", 0, 0.3 * Math.sin(T * wag - 0.8), 0); rot(fig, "tail3", 0, 0.3 * Math.sin(T * wag - 1.6), 0);
    const tw = Math.max(0, Math.sin(T * 2.3) - 0.93) * 8;
    rot(fig, "earL", -0.2 * tw, 0, 0.1 * tw); rot(fig, "earR", 0, 0, 0);
    if (!stag && Math.sin(T * 1.3) > 0.985) face = "closed";
    let glow = stag ? 0.15 * (0.5 + 0.5 * Math.sin(T * 1.6)) : 0;
    if (clip === "attack" && !stag) {
      // crouch and wiggle (0-0.3) → leap (0.3-0.5) jaws open → land (0.5-0.7) → recover
      const cr = bump(0, 0.26, 0.3, 0.38, t), air = bump(0.3, 0.42, 0.52, 0.8, t), bite = bump(0.34, 0.42, 0.5, 0.6, t);
      const hop = Math.sin(clamp((t - 0.3) / 0.3, 0, 1) * Math.PI);
      off(fig, "root", 0, -0.05 * cr + 0.07 * hop, 0.2 * air);
      rot(fig, "root", 0.18 * cr - 0.22 * air, 0.1 * Math.sin(t * 40) * cr, 0);
      rot(fig, "chest", 0.14 * cr - 0.18 * air, 0, 0);
      rot(fig, "neck", -0.35 * air + 0.25 * cr, 0, 0); rot(fig, "head", -0.25 * bite, 0, 0);
      rot(fig, "jaw", 0.8 * bite, 0, 0);
      for (const s of ["L", "R"]) {
        rot(fig, "scap" + s, -1.1 * air + 0.35 * cr, 0, 0); rot(fig, "elb" + s, 0.7 * cr - 0.3 * air, 0, 0); rot(fig, "wri" + s, 0.4 * air, 0, 0);
        rot(fig, "hip" + s, 0.8 * air - 0.45 * cr, 0, 0); rot(fig, "stif" + s, -0.55 * cr + 0.2 * air, 0, 0); rot(fig, "hock" + s, 0.5 * cr, 0, 0);
      }
      rot(fig, "tail1", 0.4 * air - 0.2 * cr, 0.2 * Math.sin(t * 30), 0);
      rot(fig, "earL", 0.4 * cr, 0, 0); rot(fig, "earR", 0.4 * cr, 0, 0);
      face = "fierce";
    } else if (clip === "attack") {
      // rear up (0-0.35) → slam down, head low, charge (0.35-0.7) with a glow flare → recover
      const rear = bump(0, 0.3, 0.34, 0.46, t), ch = bump(0.38, 0.52, 0.72, 1.1, t), flare = bump(0.42, 0.5, 0.62, 0.95, t);
      rot(fig, "root", -0.55 * rear + 0.06 * ch, 0, 0);
      off(fig, "root", 0, 0.03 * rear, 0.16 * ch);
      rot(fig, "chest", -0.2 * rear, 0, 0);
      rot(fig, "neck", -0.3 * rear + 0.75 * ch, 0, 0); rot(fig, "head", 0.1 * rear + 0.55 * ch, 0, 0);
      for (const s of ["L", "R"]) {
        rot(fig, "scap" + s, -0.8 * rear + 0.35 * ch, 0, 0); rot(fig, "elb" + s, 1.3 * rear, 0, 0); rot(fig, "wri" + s, -0.6 * rear, 0, 0);
        rot(fig, "hip" + s, 0.4 * rear - 0.3 * ch, 0, 0); rot(fig, "stif" + s, -0.2 * rear, 0, 0);
      }
      glow = 0.2 + 2.2 * flare;
    } else if (clip === "hurt") {
      const k = Math.exp(-t * 6) * sstep(0, 0.05, t);
      rot(fig, "chest", -0.15 * k, 0, 0.12 * k); rot(fig, "neck", 0.3 * k, 0, 0); rot(fig, "head", 0.3 * k, 0.3 * k, 0.2 * k);
      off(fig, "root", 0, 0.01 * k, -0.06 * k);
      face = t < 0.4 ? "hurt" : "open";
    }
    emitBoost(fig, glow);
    setFace(fig, face);
    return t < (LENGTH[clip] ?? 1);
  }

  const C = { ik, aimGrip, rot, addRot, off, reset, wpos, toW, toM, sstep, bump, turnBone, clamp, V3, setFace, emitBoost, TAU,
    /** the shared clip for this skeleton (humanoid / quadruped) — custom poses layer their own attack on base(fig, "idle", 0, T) */
    base: (fig, clip, t, T) => (fig.kind === "humanoid" ? humanoid(fig, clip, t, T) : quadruped(fig, clip, t, T)) };
  /** pose a figure: clip ∈ idle | attack | hurt | victory | rest; t = seconds into the clip, T = global time */
  function pose(fig, clip, t, T) {
    reset(fig);
    if (clip === "rest") return true;
    if (fig.spec && fig.spec.pose) { const r = fig.spec.pose(fig, clip, t, T, C); if (r !== undefined) return r; }
    return fig.kind === "humanoid" ? humanoid(fig, clip, t, T) : quadruped(fig, clip, t, T);
  }
  /** contact time of this figure's attack, and how long the clip runs */
  const timing = (fig) => ({ hit: (fig.spec && fig.spec.moves && fig.spec.moves.attack && fig.spec.moves.attack.hit) ?? HIT[attackOf(fig)] ?? 0.4, length: (fig.spec && fig.spec.moves && fig.spec.moves.attack && fig.spec.moves.attack.length) ?? LENGTH.attack });
  return { pose, timing, LENGTH, HIT, attackOf, ...C };
})();
