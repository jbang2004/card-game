/* EmberModelFigures — rigged 3D models on the battlefield (docs/design/MINIATURES.md). A figure whose model is in
 * EmberModelArt (a Tripo model on the Mixamo skeleton, skin repaired by tools/model_art.cjs) stands as that skinned
 * mesh instead of its sculpted figure or sprite: unlit (its painted texture is the look), drawn at full resolution
 * over the pixel pass (camera layer EmberSpriteFigures.LAYER; `?model=pixel` puts it through the pass like the
 * sculpted figures, `?model=0` leaves the figure to the sprite or sculpt). It keeps its figure's spec (size, moves)
 * and plugs into EmberVoxelRender / EmberVoxelClips, so the arena stations, turns, cues and shatters it like any
 * other figure. Its clips turn the skeleton's bones in the model's own space (+z forward, +y up):
 *   · idle breathes, shifts its weight, glances down at the weapon now and then, blinks
 *   · attack flips the weapon from its resting point-down hold into a forward grip as the arm coils back over the
 *     shoulder (the blade hangs behind the head), steps in on the front foot and chops down in an arc onto the
 *     director's contact, then settles back into the resting hold; the shield tucks aside
 *   · hurt is knocked back behind the raised shield, eyes squeezed · victory raises the weapon and hops
 *   · the hair and cape behind (the "Back" joint) swing on a spring after every dash, hit and hop
 *   · the hit glow washes the texture. */
const EmberModelFigures = (() => {
  const THREE = EmberVesperThree, R = EmberVoxelRender, C = EmberVoxelClips;
  const mode = typeof location === "undefined" ? "" : new URLSearchParams(location.search).get("model") || "";
  const on = mode !== "0", LAYER = mode === "pixel" ? 0 : EmberSpriteFigures.LAYER;
  const models = new Map();                  // id → { geo, tex, data, size, joints, ibm, blade, eyes }
  const onReady = new Set();                 // told when a model is ready (the battlefield re-syncs: one may decode late)
  // the light on a lit model (see material): one value for every figure, switchable (the model demo compares them)
  // 2 soft daylight: the figures in their own colours, lit (the user's choice, 2026-10-03, over 4 radiant — the high-key
  // golden look chosen 2026-09-25 washed small figures out); ?shade=0|1|2|3|4 tries another
  const SHADE = { value: (() => { const q = typeof location !== "undefined" && new URLSearchParams(location.search).get("shade"); return q !== null && q !== false && /^[0-4]$/.test(q) ? Number(q) : 2; })() };
  const READY = Object.freeze({ id: "model", ms: 0 });
  // how each model moves: "melee" (a weapon arm, a shield, feet on the ground) · "caster" (hovers on its wings, casts
  // from the off hand)
  // how far a caster's casting arm moves (× the default): the stargazer's cloak lies on her astrolabe arm
  const ARM = { oracle: 0.35 };
  const STYLE = {
    paladin: "melee", frostking: "melee", assassin: "melee", squire: "melee", solaris: "melee", reaper: "melee", leech: "melee",
    guard: "thrust", huntress: "thrust", skeleton: "thrust",
    wisp: "caster", spark: "caster", nyx: "caster", necromancer: "caster", soulguide: "caster", oracle: "caster", vesper: "archer",
  };
  // how strong the golden rim of the "radiant" shade is on a figure (default 1 for a person, 0.4 for a beast): the amber
  // story's muted, ordinary characters (dark coats, browns and greys) keep their colours under a faint one
  const AURA = { nahira: 0.3, frederia: 0.3, rowan: 0.3, liol: 0.3, whistle: 0.3, translator: 0.3, rootkeeper: 0.3, rootmother: 0.3, nathan: 0.3, fuse: 0.3, gleaner: 0.3, appraiser: 0.3, redscarf: 0.3, clockmaker: 0.3, blacklung: 0.3, ada: 0.3, amberbody: 0.3, pawnbroker: 0.3, mirrorlegion: 0.3, earlyriser: 0.25, eve: 0.3, mirrornahira: 0.3, mirrorfrederia: 0.3, mirrorrowan: 0.3, mirrorliol: 0.3 };
  // a held thing its model holds the wrong way round — 罗温's bow came with its string toward the foe and its belly
  // toward him: turned half round about its own length where the hand grips it (see turnHeld)
  const TURNED = { rowan: "Left", mirrorrowan: "Left" };
  // a held thing its model left standing beside the hand — 黯月收割者's scythe came a hand's breadth in front of his
  // closed fist: brought into the fist (see seatHeld)
  const SEATED = { reaper: "Right" };
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const lin = (D, i) => [0, 1, 2].map((c) => Math.pow(D[i * 4 + c] / 255, 2.2));
  const texel = (M, u, v) => Math.min(M.size[1] - 1, Math.floor(v * M.size[1])) * M.size[0] + Math.min(M.size[0] - 1, Math.floor(u * M.size[0]));

  /* A model's data is inline: M.bin (base64 of the mesh; with M.z, of the mesh deflated — the Artifact build, which
   * must fit its size limit, tools/build_artifact.py; M.z 2: packed before it was deflated, see unpack), M.tex a data URI */
  function load(id, M) {
    const bytes = Uint8Array.from(atob(M.bin), (c) => c.charCodeAt(0));
    if (!M.z) { build0(id, M, bytes.buffer, M.tex); return; }
    new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()
      .then((raw) => build0(id, M, M.z === 2 ? unpack(raw, M) : raw, M.tex)).catch((e) => console.warn("model figure unavailable", id, e));
  }
  /** M.z 2 (the Artifact build): each 16-bit array stored as its low bytes then its high bytes, the triangle indices
   *  (16-bit) as zig-zagged deltas — the same layout, far better deflated */
  function unpack(raw, M) {
    const src = new Uint8Array(raw), out = new Uint8Array(raw.byteLength), n = M.count, t3 = M.tris * 3;
    const segs = [[n * 6, 1], [n * 4, 1], [n * 4, 0], [n * 4, 0], [t3 * (M.wide ? 4 : 2), M.wide ? 0 : 2]];
    let o = 0;
    for (const [len, kind] of segs) {
      if (!kind) out.set(src.subarray(o, o + len), o);
      else {
        const h = len / 2;
        if (kind === 1) for (let i = 0; i < h; i++) { out[o + 2 * i] = src[o + i]; out[o + 2 * i + 1] = src[o + h + i]; }
        else for (let i = 0, prev = 0; i < h; i++) { const z = src[o + i] | (src[o + h + i] << 8), v = (prev + ((z >>> 1) ^ -(z & 1))) & 0xffff; out[o + 2 * i] = v & 255; out[o + 2 * i + 1] = v >> 8; prev = v; }
      }
      o += Math.ceil(len / 4) * 4;
    }
    return out.buffer;
  }
  /** what that hand holds (its metal: mt 255, bound to the hand) turned half round about its own long axis, through
   *  the middle of where it is gripped — a bow's belly and string change sides, the grip stays in the fist */
  function turnHeld(M, pos, sj, sw, mt, side) {
    const hand = M.joints.findIndex((j) => j.name === side + "Hand"), ids = [];
    for (let i = 0; i < mt.length; i++) {
      if (mt[i] < 253) continue;
      let d = -1, w = -1; for (let k = 0; k < 4; k++) if (sw[i * 4 + k] > w) { w = sw[i * 4 + k]; d = sj[i * 4 + k]; }
      if (d === hand) ids.push(i);
    }
    if (ids.length < 30) return;
    const P = (i) => V3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), c = ids.reduce((a, i) => a.add(P(i)), V3()).multiplyScalar(1 / ids.length);
    let ax = V3(0.3, 1, 0.2).normalize();
    for (let it = 0; it < 30; it++) { const m = V3(); for (const i of ids) { const d = P(i).sub(c); m.addScaledVector(d, d.dot(ax)); } ax = m.normalize(); }
    let lo = Infinity, hi = -Infinity; for (const i of ids) { const t = P(i).sub(c).dot(ax); lo = Math.min(lo, t); hi = Math.max(hi, t); }
    // the grip: of its middle tenth, what lies farthest from the line through its ends (a bow's string runs along that line)
    const off = (i) => { const d = P(i).sub(c); return d.addScaledVector(ax, -d.dot(ax)); };
    const mid = ids.filter((i) => Math.abs((P(i).sub(c).dot(ax) - lo) / (hi - lo) - 0.5) < 0.05), far = Math.max(...mid.map((i) => off(i).length()));
    const grip = mid.filter((i) => off(i).length() > far * 0.6), g = grip.reduce((a, i) => a.add(P(i)), V3()).multiplyScalar(1 / grip.length);
    for (const i of ids) { const d = P(i).sub(g), along = d.dot(ax); d.addScaledVector(ax, -along).negate().addScaledVector(ax, along).add(g); pos[i * 3] = d.x; pos[i * 3 + 1] = d.y; pos[i * 3 + 2] = d.z; }
  }
  /** of the hand's held surface (mt 255, bound to the hand): the fist is the part joined to the arm; the rest — islands
   *  of mesh that touch nothing but held surface — is the thing itself → { thing: its vertices, fist: the fist's middle } */
  function looseHeld(M, pos, q, sj, sw, mt, idx, side) {
    const n = mt.length, hand = M.joints.findIndex((j) => j.name === side + "Hand"), held = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (mt[i] < 253) continue;
      let d = -1, w = -1; for (let k = 0; k < 4; k++) if (sw[i * 4 + k] > w) { w = sw[i * 4 + k]; d = sj[i * 4 + k]; }
      if (d === hand) held[i] = 1;
    }
    // (vertices split along uv seams are one: joined by where they are, then by the triangles)
    const key = new Map(), par = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = q[i * 3] + "," + q[i * 3 + 1] + "," + q[i * 3 + 2]; if (!key.has(k)) key.set(k, i); par[i] = key.get(k); }
    const find = (a) => { while (par[a] !== a) a = par[a] = par[par[a]]; return a; };
    for (let t = 0; t < idx.length; t += 3) { const a = find(idx[t]); par[find(idx[t + 1])] = a; par[find(idx[t + 2])] = a; }
    const joined = new Set(); for (let i = 0; i < n; i++) if (!held[i]) joined.add(find(i));
    const fist = V3(), thing = []; let nf = 0;
    for (let i = 0; i < n; i++) if (held[i]) { if (joined.has(find(i))) { fist.x += pos[i * 3]; fist.y += pos[i * 3 + 1]; fist.z += pos[i * 3 + 2]; nf++; } else thing.push(i); }
    if (!nf || thing.length < 30) return null;
    return { thing, fist: fist.multiplyScalar(1 / nf) };
  }
  /** the thing's own long axis (through its middle) and how far it runs along it either way */
  function axisOf(pos, ids) {
    const P = (i) => V3(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]), c = ids.reduce((a, i) => a.add(P(i)), V3()).multiplyScalar(1 / ids.length);
    let ax = V3(0.3, 1, 0.2).normalize();
    for (let it = 0; it < 30; it++) { const m = V3(); for (const i of ids) { const d = P(i).sub(c); m.addScaledVector(d, d.dot(ax)); } ax = m.normalize(); }
    let lo = Infinity, hi = -Infinity; for (const i of ids) { const t = P(i).sub(c).dot(ax); lo = Math.min(lo, t); hi = Math.max(hi, t); }
    return { c, ax, lo, hi, P };
  }
  /** what that hand holds brought into its fist: moved across its own length until its shaft runs through the middle
   *  of the fist → the shift (bind space) */
  function seatHeld(M, pos, q, sj, sw, mt, idx, side) {
    const L = looseHeld(M, pos, q, sj, sw, mt, idx, side); if (!L) return null;
    const { c, ax, P } = axisOf(pos, L.thing);
    // the shaft where the fist is along it (a scythe's blade, a guard or a pommel lie elsewhere along the length)
    const t0 = L.fist.clone().sub(c).dot(ax), near = L.thing.filter((i) => Math.abs(P(i).sub(c).dot(ax) - t0) < 0.04);
    if (near.length < 6) return null;
    const off = L.fist.clone().sub(near.reduce((a, i) => a.add(P(i)), V3()).multiplyScalar(1 / near.length));
    off.addScaledVector(ax, -off.dot(ax));
    for (const i of L.thing) { pos[i * 3] += off.x; pos[i * 3 + 1] += off.y; pos[i * 3 + 2] += off.z; }
    return off;
  }
  /** the two ends of the thing that hand holds (bind space): [the end by the fist, its far end] — where the thing
   *  itself is (a blade's line runs beside the wrist, not through it) */
  function thingEnds(M, pos, q, sj, sw, mt, idx, side) {
    const L = looseHeld(M, pos, q, sj, sw, mt, idx, side); if (!L) return null;
    const { c, ax, lo, hi } = axisOf(pos, L.thing), a = c.clone().addScaledVector(ax, lo), b = c.clone().addScaledVector(ax, hi);
    return a.distanceTo(L.fist) < b.distanceTo(L.fist) ? [a, b] : [b, a];
  }
  /** fingers given back their own bones on that hand (the converter binds a whole hand to its hand bone: nothing in
   *  it can close). A hand's vertex past a knuckle goes to the finger joint whose bone it lies along — rigidly; enough
   *  for a fist (see fists). The thumb's root stays with the palm */
  function fingerSkin(M, pos, sj, sw, mt, S) {
    const J = M.joints, idx = (n) => J.findIndex((j) => j.name === n), hand = idx(S + "Hand"), m1 = idx(S + "HandMiddle1");
    if (hand < 0 || m1 < 0) return;
    const P = J.map((_, i) => V3().setFromMatrixPosition(new THREE.Matrix4().fromArray(M.ibm, i * 16).invert()));
    const segs = [], near = 0.26 * P[m1].distanceTo(P[hand]);
    for (const F of ["Index", "Middle", "Ring", "Pinky", "Thumb"]) for (let k = F === "Thumb" ? 2 : 1; k <= 3; k++) {
      const j = idx(S + "Hand" + F + k), c = idx(S + "Hand" + F + (k + 1));
      if (j >= 0 && c >= 0) segs.push({ j, a: P[j], d: P[c].clone().sub(P[j]), first: k === 1, last: k === 3 });
    }
    const p = V3(), v = V3();
    for (let i = 0; i < pos.length / 3; i++) {
      if (mt && mt[i] >= 253) continue;                   // (what it holds, and the hand round it, stay as they are)
      let d = -1, w = -1; for (let k = 0; k < 4; k++) if (sw[i * 4 + k] > w) { w = sw[i * 4 + k]; d = sj[i * 4 + k]; }
      if (d !== hand) continue;
      p.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      let best = null, bd = near;
      for (const sg of segs) {
        const t = v.copy(p).sub(sg.a).dot(sg.d) / sg.d.lengthSq();
        if (t < (sg.first ? 0.12 : -0.2) || (t > 1.25 && !sg.last)) continue;
        const dist = v.copy(sg.a).addScaledVector(sg.d, Math.min(1, Math.max(0, t))).distanceTo(p);
        if (dist < bd) { bd = dist; best = sg; }
      }
      if (best) { sj.set([best.j, 0, 0, 0], i * 4); sw.set([255, 0, 0, 0], i * 4); }
    }
  }
  function build0(id, M, raw, texSrc) {
    const n = M.count;
    let off = 0;
    const take = (T, len) => { const a = new T(raw, off, len); off += Math.ceil((len * T.BYTES_PER_ELEMENT) / 4) * 4; return a; };
    const q = take(Uint16Array, n * 3), uv = take(Uint16Array, n * 2), sj = take(Uint8Array, n * 4), sw = take(Uint8Array, n * 4), idx = take(M.wide ? Uint32Array : Uint16Array, M.tris * 3);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) { const c = i % 3; pos[i] = M.lo[c] + (q[i] / 65535) * (M.hi[c] - M.lo[c]); }
    if (TURNED[id] && M.mt) turnHeld(M, pos, sj, sw, Uint8Array.from(atob(M.mt), (c) => c.charCodeAt(0)), TURNED[id]);
    // one whose move closes its hands (its sheet's body.fists) or works its fingers (body.hands): its fingers get
    // their bones back
    const fz = EmberMoveSheet.SUITES[id]?.fists || EmberMoveSheet.SUITES[id]?.hands, mt0 = M.mt ? Uint8Array.from(atob(M.mt), (c) => c.charCodeAt(0)) : null;
    if (fz && !M.beast) for (const S of fz === "both" ? ["Left", "Right"] : [fz]) fingerSkin(M, pos, sj, sw, mt0, S);
    // one that carries a sheath: where its blade itself lies (thingEnds)
    const thing = EmberMoveSheet.SUITES[id]?.carry === "sheath" && mt0 ? thingEnds(M, pos, q, sj, sw, mt0, idx, "Right") : null;
    // (what the converter measured on the thing — its blade, its centre — moves with it)
    let blade = M.blade, hold = M.hold || {};
    const seat = SEATED[id] && M.mt ? seatHeld(M, pos, q, sj, sw, Uint8Array.from(atob(M.mt), (c) => c.charCodeAt(0)), idx, SEATED[id]) : null;
    if (seat) {
      const mv = (p) => p && [p[0] + seat.x, p[1] + seat.y, p[2] + seat.z], S = SEATED[id][0];
      if (blade && S === "R") blade = blade.map(mv);
      hold = { ...hold, [S]: mv(hold[S]) };
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2, true));
    geo.setAttribute("skinIndex", new THREE.BufferAttribute(sj, 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4, true));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingBox();
    if (M.lit) {
      // smooth normals, welded across the uv seams (they split vertices by position), and the metal mask
      const key = new Map(), acc = new Float32Array(n * 3), slot = new Int32Array(n);
      for (let i = 0; i < n; i++) { const k = q[i * 3] + "," + q[i * 3 + 1] + "," + q[i * 3 + 2]; if (!key.has(k)) key.set(k, i); slot[i] = key.get(k); }
      const e1 = V3(), e2 = V3(), fn = V3(), pa = V3(), pb = V3(), pc = V3();
      for (let t = 0; t < idx.length; t += 3) {
        pa.fromArray(pos, idx[t] * 3); pb.fromArray(pos, idx[t + 1] * 3); pc.fromArray(pos, idx[t + 2] * 3);
        fn.crossVectors(e1.subVectors(pb, pa), e2.subVectors(pc, pa));
        for (let c = 0; c < 3; c++) { const o = slot[idx[t + c]] * 3; acc[o] += fn.x; acc[o + 1] += fn.y; acc[o + 2] += fn.z; }
      }
      const nrm = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const o = slot[i] * 3, l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]) || 1; nrm[i * 3] = acc[o] / l; nrm[i * 3 + 1] = acc[o + 1] / l; nrm[i * 3 + 2] = acc[o + 2] / l; }
      geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      const mt = M.mt ? Uint8Array.from(atob(M.mt), (c) => c.charCodeAt(0)) : new Uint8Array(n);
      geo.setAttribute("aMetal", new THREE.BufferAttribute(mt, 1, true));
    }
    const img = new Image();
    img.onload = () => {
      // a phone (a coarse pointer) keeps each texture at 1024: a quarter of the memory, and on its small figures the same look
      const cap = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches ? 1024 : 4096, k = Math.min(1, cap / Math.max(img.width, img.height));
      const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, cv.width, cv.height);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;       // glTF uvs: top-left origin
      const m = { geo, tex, data: g.getImageData(0, 0, cv.width, cv.height).data, size: [cv.width, cv.height], joints: M.joints, ibm: M.ibm, blade, hold, thing, style: M.style, lit: !!M.lit, noTuck: !!M.lit && !M.shield, beast: !!M.beast, aura: AURA[id], tq: M.tq || null };
      m.eyes = m.beast ? null : findEyes(m, pos, sj, sw, uv);
      models.set(id, m);
      onReady.forEach((fn) => fn(id));
    };
    img.src = texSrc;
  }
  /** the painted eyes, found on the model rather than in the texture (a Tripo atlas scatters them over small islands):
   *  the dark-textured vertices on the front of the face, split left / right → a bind-space box per eye
   *  (x0, y0, x1, y1), the face's front depth, and the skin colour around them (linear) */
  function findEyes(M, pos, sj, sw, uv) {
    const head = M.joints.findIndex((j) => j.name === "Head");
    if (head < 0) return null;
    const hp = new THREE.Matrix4().fromArray(M.ibm, head * 16).invert(), hx = hp.elements[12], hy = hp.elements[13], hz = hp.elements[14];
    // the face is the skin on the front of the head; the eyes are the dark pixels inside it (never the hood or collar
    // around it, which dark-clad figures have right beside the face)
    const D = M.data, dark = [], skin = [0, 0, 0, 0], face = [9, 9, -9, -9];
    const front = [];
    for (let i = 0; i < pos.length / 3; i++) {
      let w = 0; for (let k = 0; k < 4; k++) if (sj[i * 4 + k] === head) w += sw[i * 4 + k] / 255;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (w < 0.5 || z < hz + 0.1 || Math.abs(x - hx) > 0.13 || Math.abs(y - hy) > 0.08) continue;
      const t = texel(M, uv[i * 2] / 65535, uv[i * 2 + 1] / 65535) * 4, r = D[t], g = D[t + 1], b = D[t + 2];
      front.push([x, y, z, r, g, b]);
      if (r > 200 && g > 140 && b > 100 && r > g + 12 && g > b + 6) {
        skin[0] += r; skin[1] += g; skin[2] += b; skin[3]++;
        face[0] = Math.min(face[0], x); face[1] = Math.min(face[1], y); face[2] = Math.max(face[2], x); face[3] = Math.max(face[3], y);
      }
    }
    for (const [x, y, z, r, g, b] of front) {
      const inFace = x > face[0] + 0.01 && x < face[2] - 0.01 && y > face[1] + 0.01 && y < face[3] - 0.005;
      if (inFace && 0.3 * r + 0.59 * g + 0.11 * b < 60 && Math.abs(x - hx) > 0.022) dark.push([x, y, z]);   // the mouth sits on the centre line
    }
    const sides = [dark.filter((p) => p[0] < hx), dark.filter((p) => p[0] >= hx)];
    if (sides.some((s) => s.length < 2) || !skin[3]) return null;
    const box = (s) => { const x = s.map((p) => p[0]), y = s.map((p) => p[1]); return new THREE.Vector4(Math.min(...x) - 0.02, Math.min(...y) - 0.016, Math.max(...x) + 0.02, Math.max(...y) + 0.016); };
    const toLin = (c) => Math.pow(c / skin[3] / 255, 2.2);
    return { a: box(sides[0]), b: box(sides[1]), z: Math.min(...dark.map((p) => p[2])) - 0.02, skin: V3(toLin(skin[0]), toLin(skin[1]), toLin(skin[2])) };
  }
  if (on && typeof EmberModelArt !== "undefined") for (const [id, M] of Object.entries(EmberModelArt)) { try { load(id, M); } catch (e) { console.warn("model figure unavailable", id, e); } }
  const has = (id) => models.has(id);

  /** unlit texture + the hit glow (+ a caster's charge glow around what her off hand holds); a blink paints the dark pixels of each eye with the face's skin except a thin lid
   *  line through its middle (tested in bind space, so the atlas layout does not matter) */
  // a caster whose held thing is fire: the modelled orb is hidden and a real fireball (EmberFire) burns in its place
  const FIRE = { spark: { r: 0.075 }, jingchen: { r: 0.095 } };
  // a signature figure's lit blade (EmberSkillFx sets its strength): the blade's bind-space segment, its strength, the
  // time its shimmer runs on, and the golden rim that swells with it
  const NO_LUX = { a: { value: V3(9, 9, 9) }, b: { value: V3(9, 9, 9.1) }, k: { value: 0 }, t: { value: 0 }, rim: { value: 0 } };
  // a beast's own light (BEASTS[id].look): what glows on it, and a spirit's inner light
  const NO_LOOK = () => ({ emitC: { value: V3() }, emitK: { value: 0 }, ghost: { value: 0 }, ghostC: { value: V3() }, t: { value: 0 }, key: { value: 1 } });
  // an arrival or a death (EmberVoxelArena): the figure shows from its feet up / burns away from its head down along a
  // noisy front (uDisK 0 whole → 1 gone; uDisY its bind-space height range), the front lit in uDisC
  const disOf = (M) => {
    if (!M.geo.boundingBox) M.geo.computeBoundingBox();
    const b = M.geo.boundingBox;
    return { k: { value: 0 }, y: { value: new THREE.Vector2(b.min.y, b.max.y) }, c: { value: V3(1, 0.85, 0.5) } };
  };
  function material(M, hit, blink, glow, hide = false, lux = NO_LUX, dis = disOf(M), look = NO_LOOK()) {
    const m = new THREE.MeshBasicMaterial({ map: M.tex, side: THREE.DoubleSide });
    m.toneMapped = false;
    const E = M.eyes || { a: new THREE.Vector4(9, 9, 9, 9), b: new THREE.Vector4(9, 9, 9, 9), z: 9, skin: V3() };
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { uShade: SHADE, uHitC: hit, uBlink: blink, uGlow: glow.k, uGlowC: glow.c, uOrb: glow.at, uEyeA: { value: E.a }, uEyeB: { value: E.b }, uEyeZ: { value: E.z }, uSkin: { value: E.skin }, uAura: { value: M.aura ?? (M.beast ? 0.4 : 1) }, uHide: { value: hide ? 1 : 0 },
        uBladeA: lux.a, uBladeB: lux.b, uBladeK: lux.k, uBladeT: lux.t, uRimK: lux.rim, uDisK: dis.k, uDisY: dis.y, uDisC: dis.c,
        uEmitC: look.emitC, uEmitK: look.emitK, uGhost: look.ghost, uGhostC: look.ghostC, uFxT: look.t, uKey: look.key });
      s.vertexShader = "varying vec3 vBind;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vBind = position;");
      if (M.lit) s.vertexShader = "attribute float aMetal; varying float vMetal; varying vec3 vN;\n" + s.vertexShader.replace("#include <fog_vertex>", "#include <fog_vertex>\n vMetal = aMetal; vN = normalize(transformedNormal);");
      s.fragmentShader = `#ifdef LIT
        varying float vMetal; varying vec3 vN;
        #endif
        uniform vec3 uHitC, uSkin, uGlowC, uBladeA, uBladeB, uDisC, uEmitC, uGhostC; uniform float uShade, uBlink, uEyeZ, uGlow, uAura, uHide, uBladeK, uBladeT, uRimK, uDisK, uEmitK, uGhost, uFxT, uKey; uniform vec4 uEyeA, uEyeB, uOrb; uniform vec2 uDisY; varying vec3 vBind;
        float dh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float dn(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(dh(i), dh(i + vec3(1, 0, 0)), f.x), mix(dh(i + vec3(0, 1, 0)), dh(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(dh(i + vec3(0, 0, 1)), dh(i + vec3(1, 0, 1)), f.x), mix(dh(i + vec3(0, 1, 1)), dh(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
        float lid(vec4 r) {                                   // 1 where this eye is closed over by the lid
          if (vBind.z < uEyeZ || vBind.x < r.x || vBind.x > r.z || vBind.y < r.y || vBind.y > r.w) return 0.0;
          float mid = 0.5 * (r.y + r.w), h = 0.5 * (r.w - r.y) - 0.012;
          return step((1.0 - uBlink) * h + 0.0035, abs(vBind.y - mid));
        }
        ` + s.fragmentShader.replace("#include <map_fragment>", `
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          if (uBlink > 0.0 && dot(sampledDiffuseColor.rgb, vec3(0.3, 0.59, 0.11)) < 0.3)
            sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, uSkin, max(lid(uEyeA), lid(uEyeB)));
          diffuseColor *= sampledDiffuseColor;
          #ifdef LIT
          if (uHide > 0.5 && abs(vMetal - 250.0 / 255.0) < 0.003) discard;   // the orb alone (not the hand round it): real fire burns there
          {
            // what the surface is (the converter's mask): 1 polished metal (blade, shield), 0.78 head (skin), 0.5 body
            // (its gold trim shines), 0 hair. uShade: 0 the bare texture · 1 warm key · 2 soft daylight · 3 anime cel
            // (flat paint, two tones, cool shade; the figure's outline shell shows) · 4 radiant (high key, golden aura)
            vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), Lk = normalize(vec3(-0.45, 0.75, 0.6)), Vw = vec3(0.0, 0.0, 1.0);
            vec3 base = diffuseColor.rgb;
            float weapon = step(0.9, vMetal), head = step(0.7, vMetal) * (1.0 - weapon), body = step(0.4, vMetal) * (1.0 - head) * (1.0 - weapon);
            float mx = max(base.r, max(base.g, base.b)), mn = min(base.r, min(base.g, base.b)), sat = (mx - mn) / max(mx, 1e-3);
            float gold = smoothstep(0.35, 0.6, sat) * step(base.b, base.g) * step(base.g, base.r) * smoothstep(0.12, 0.3, mx);
            float metal = max(weapon * smoothstep(0.1, 0.4, mx), gold * body);
            // skin (on the head): the texture blurred (a coarse mip) evens out the blotches of the generated face,
            // then it is set to one clean tone at that brightness; eyes, brows and lips (dark or red) stay
            vec3 soft = texture2D(map, vMapUv, 3.5).rgb;
            float sl = dot(soft, vec3(0.3, 0.59, 0.11)), bl = dot(base, vec3(0.3, 0.59, 0.11));
            float skin = head * smoothstep(0.18, 0.32, sl) * (1.0 - smoothstep(0.42, 0.6, sat)) * step(soft.b, soft.r) * smoothstep(0.1, 0.2, bl);
            vec3 skinTone = vec3(1.0, 0.74, 0.62) * (0.42 + 0.9 * sl) + 0.25 * (base - soft);
            if (uShade > 0.5) base = mix(base, skinTone, skin * 0.8);
            float ndl = dot(N, Lk), wrap = clamp((ndl + 0.4) / 1.4, 0.0, 1.0), rim = pow(1.0 - clamp(N.z, 0.0, 1.0), 3.0);
            vec3 Rf = reflect(-Vw, N);
            float env = smoothstep(-0.35, 0.65, Rf.y) * 0.85 + 0.35 * pow(max(0.0, 1.0 - abs(Rf.x)), 6.0);
            float spec = pow(max(dot(N, normalize(Lk + Vw)), 0.0), 42.0);
            vec3 tintS = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.82, 0.5), gold);
            vec3 lit = base;
            if (uShade < 0.5) lit = base;
            else if (uShade < 1.5) {
              lit = base * (0.74 + 0.5 * wrap) * vec3(1.05, 1.0, 0.93);
              lit = mix(lit, base * (0.42 + 1.05 * env) + tintS * spec * 1.6, metal * 0.9);
              lit += vec3(1.0, 0.8, 0.45) * rim * 0.32;
            } else if (uShade < 2.5) {
              // daylight: a neutral key, a sky / ground fill, the skin kept warm in its shade
              float sky = 0.5 + 0.5 * N.y;
              vec3 fill = mix(vec3(0.62, 0.6, 0.62), vec3(0.78, 0.82, 0.9), sky);
              lit = base * (fill + vec3(0.5, 0.49, 0.47) * max(ndl, 0.0));
              lit += skin * base * vec3(0.12, 0.04, 0.02) * (1.0 - wrap);
              lit = mix(lit, base * (0.35 + 1.1 * env) + tintS * spec * 1.3, metal * 0.85);
              lit += vec3(0.9, 0.92, 1.0) * rim * 0.12;
            } else if (uShade < 3.5) {
              // anime cel: the painted detail flattened (a coarse mip, dark lines kept), lit and shaded tones with a
              // crisp edge, shade cool and a little purple (warm on skin), a hard glint on metal
              vec3 flat_ = texture2D(map, vMapUv, 2.5).rgb;
              flat_ = mix(flat_, skinTone, skin);
              vec3 paint = mix(base, flat_ * 1.04, (1.0 - weapon) * smoothstep(0.12, 0.3, bl) * 0.75);
              paint = mix(vec3(dot(paint, vec3(0.3, 0.59, 0.11))), paint, 1.15);
              float t = smoothstep(0.44, 0.47, wrap);
              vec3 shade = paint * mix(vec3(0.7, 0.68, 0.86), vec3(0.9, 0.72, 0.7), skin);
              lit = mix(shade, paint * 1.06, t);
              base = paint;
              float band = smoothstep(0.55, 0.6, env);
              lit = mix(lit, base * mix(0.55, 1.35, band) + tintS * step(0.6, spec) * 0.9, metal * 0.85);
              lit += vec3(1.0, 0.95, 0.85) * smoothstep(0.62, 0.66, rim) * 0.22;
            } else {
              // radiant: high key, shadows barely there, a strong golden rim like an aura, metal blazing
              lit = base * (1.02 + 0.3 * wrap) * vec3(1.07, 1.02, 0.93);
              lit = mix(lit, base * (0.6 + 1.35 * env) + tintS * spec * 2.6, metal * 0.95);
              // (a beast's dark hide keeps its colour: a fainter aura)
              lit += vec3(1.0, 0.76, 0.34) * (rim * 0.9 + pow(rim, 0.5) * 0.18) * uAura;
              lit = mix(lit, vec3(1.0, 0.93, 0.78), 0.08 * uAura);
            }
            // a lit blade: the metal along the blade's segment burns gold, a brighter band running up it toward the
            // point; the golden rim swells with it
            if (uBladeK > 0.0) {
              vec3 ab = uBladeB - uBladeA; float bs = dot(vBind - uBladeA, ab) / dot(ab, ab);
              float bd = length(vBind - (uBladeA + ab * clamp(bs, 0.0, 1.0)));
              float on = weapon * (1.0 - smoothstep(0.04, 0.075, bd)) * step(-0.08, bs);
              float band = exp(-pow((fract(bs * 0.85 - uBladeT * 0.55) - 0.5) * 6.0, 2.0));
              lit += vec3(1.0, 0.72, 0.32) * uBladeK * on * (0.4 + 0.6 * band + 0.35 * clamp(bs, 0.0, 1.0));
            }
            lit += vec3(1.0, 0.76, 0.34) * (rim + 0.25 * pow(rim, 0.5)) * uRimK;
            lit *= uKey;                                      // a dark beast kept dark (the radiant key would pale it)
            // what glows on a beast: texels of about its glow's colour (lava in a dragon's cracks, a rune crystal, a
            // phoenix's heart), saturated and bright, lit up by uEmitK (its clips pulse it)
            if (uEmitK > 0.0) {
              vec3 kn = uEmitC / max(max(uEmitC.r, max(uEmitC.g, uEmitC.b)), 1e-3), bn = base / max(mx, 1e-3);
              float em = smoothstep(0.62, 0.9, 1.0 - 0.8 * length(bn - kn)) * smoothstep(0.35, 0.6, sat) * smoothstep(0.28, 0.6, mx);
              lit += uEmitC * em * uEmitK * (1.0 + 0.6 * mx);
            }
            // a spirit: its body dimmed and lit from within, glow flowing up it and gathering at its edges
            if (uGhost > 0.0) {
              float flow = dn(vBind * 26.0 + vec3(0.0, -uFxT * 0.9, uFxT * 0.3)) * 0.6 + dn(vBind * 61.0 - vec3(0.0, uFxT * 1.7, 0.0)) * 0.4;
              vec3 spirit = lit * 0.5 + uGhostC * (0.16 + 0.95 * rim + 0.5 * pow(rim, 0.5) * flow + 0.3 * smoothstep(0.55, 0.8, flow));
              lit = mix(lit, spirit, uGhost);
            }
            diffuseColor.rgb = lit;
          }
          #endif
          diffuseColor.rgb += uHitC * (0.45 + 0.55 * diffuseColor.rgb);
          // (what it holds lights up — the lantern, the orb, the blade — not the coat that hangs beside it at rest)
          #ifdef LIT
          if (uGlow > 0.0) diffuseColor.rgb += uGlowC * uGlow * (1.0 - smoothstep(0.4, 1.0, distance(vBind, uOrb.xyz) / uOrb.w)) * step(0.9, vMetal);
          #else
          if (uGlow > 0.0) diffuseColor.rgb += uGlowC * uGlow * (1.0 - smoothstep(0.4, 1.0, distance(vBind, uOrb.xyz) / uOrb.w));
          #endif
          if (uDisK > 0.0) {                                  // the front: gone above it (a death) / not yet below it (an arrival)
            float hh = clamp((vBind.y - uDisY.x) / max(uDisY.y - uDisY.x, 1e-3), 0.0, 1.0);
            float sw = (1.0 - hh) * 0.84 + (dn(vBind * 18.0) * 0.65 + dn(vBind * 47.0) * 0.35) * 0.16;
            if (sw < uDisK * 1.02) discard;
            float edge = 1.0 - smoothstep(0.0, 0.045, sw - uDisK * 1.02);
            diffuseColor.rgb = mix(diffuseColor.rgb, uDisC * 1.5, edge * 0.8) + uDisC * edge * edge * 0.8;
          }`);
    };
    if (M.lit) m.defines = { LIT: "" };
    m.customProgramCacheKey = () => (M.lit ? "ember-model-lit" : "ember-model");
    return m;
  }

  /* The beasts' signatures (the humanoids' are their SUITES): a beast moves on its voxel figure's coded clips, so its
   * signature is the timing round the clip and its effects (EmberSkillFx) — the charge, the lunge or leap, the blow's
   * mark (a bite, a raking claw, a burst of fire), what it leaves on the ground, how it triumphs, what hangs round it at
   * rest. The rarer it is, the heavier its presence: a legend dims the stage as it strikes, shakes the ground, its
   * element drifting round it; now and then it rears and roars (flourish: its victory clip, every so many seconds).
   * Written in the move sheets (content/moves.js, compiled by EmberMoveSheet — tune them there):
   *   sig: windup (ms added to its charge) · draw (a shooter: ms before its shot leaves) · leap (the share of the lead
   *        when it leaves its station) · dash leap|lunge · reach (× its size, where it strikes from) · hitstop (frames,
   *        by tier) · post / rise / back (seconds it stays at the foe, and hops home) · stay (it strikes from where it
   *        stands) · fx (the recipe)
   *   look: emit [r, g, b] (what glows on it: texels of about that colour, emitK strong, pulsing with its clips) ·
   *         ghost (0–1: a spirit — its body lit from within, a flowing glow toward its edges, in ghostC)
   *   blade: [[x, y, z] hilt, [x, y, z] point] in bind space, on bladeBone (a rider's sword: its swoosh) */
  const BEASTS = {};

  /** a beast (tools/beast_prep.cjs): the model skinned to its voxel figure's own skeleton (same bone names, rest
   *  rotations identity), so the figure's clips and custom pose (EmberVoxelClips) move it unchanged */
  function buildBeast(id) {
    const M = models.get(id), spec = EmberVoxelKit.get(id), root = new THREE.Group(), Bs = BEASTS[id] || {};
    const bones = M.joints.map((j) => { const b = new THREE.Bone(); b.name = j.name; b.position.fromArray(j.t); return b; });
    M.joints.forEach((j, i) => (j.parent >= 0 ? bones[j.parent] : root).add(bones[i]));
    const inv = M.joints.map((_, i) => new THREE.Matrix4().fromArray(M.ibm, i * 16));
    const tint = new THREE.Color(spec.moves?.attack?.tint ?? 0xffd070);
    const hit = { value: V3() }, blink = { value: 0 }, glow = { k: { value: 0 }, c: { value: V3(tint.r, tint.g, tint.b) }, at: { value: new THREE.Vector4(0, -9, 0, 0.09) } };
    const look = NO_LOOK(), L = Bs.look || {};
    if (L.emit) { look.emitC.value.set(...L.emit); look.emitK.value = L.emitK ?? 0.6; }
    if (L.ghost) { look.ghost.value = L.ghost; look.ghostC.value.set(...L.ghostC); }
    if (L.key) look.key.value = L.key;
    const dis = disOf(M), mat = material(M, hit, blink, glow, false, NO_LUX, dis, look), mesh = new THREE.SkinnedMesh(M.geo, mat);
    mesh.frustumCulled = false; mesh.layers.set(LAYER);
    root.add(mesh); root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones, inv), new THREE.Matrix4());
    const om = new THREE.MeshBasicMaterial({ color: 0x3a2a1e, side: THREE.BackSide });
    om.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <skinning_vertex>", "#include <skinning_vertex>\n transformed += normalize(objectNormal) * 0.0055;").replace("#include <project_vertex>", "#include <project_vertex>\n gl_Position.z += 0.0015 * gl_Position.w;"); };
    om.customProgramCacheKey = () => "ember-model-outline";
    const outline = new THREE.SkinnedMesh(M.geo, om);
    outline.frustumCulled = false; outline.layers.set(LAYER); outline.visible = false;
    root.add(outline); outline.bind(mesh.skeleton, new THREE.Matrix4());
    const cols = [], uv = M.geo.attributes.uv;
    for (let i = 0; i < uv.count; i += 37) cols.push(...lin(M.data, texel(M, uv.getX(i), uv.getY(i))));
    const J = Object.fromEntries(bones.map((b) => [b.name, b]));
    // a rider's sword: two points on the sword hand (its swoosh, EmberSkillFx)
    const bb = Bs.blade, hi = bb ? M.joints.findIndex((j) => j.name === bb.bone) : -1;
    const blade = hi >= 0 ? bb.at.map((p) => { const o = new THREE.Object3D(); o.position.copy(V3(...p)).applyMatrix4(inv[hi]); bones[hi].add(o); return o; }) : null;
    const rest = new Map(); root.traverse((o) => rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
    return { model: true, beast: true, id, spec, kind: spec.kind, char: { kind: spec.kind }, root, mesh, outline, bones, J, skel: mesh.skeleton, rest,
      props: [], mats: [mat, om], geos: [], hit, blink, glow, dis, M, style: "beast", faces: null, face: null, phase: Math.random() * 6.28,
      sig: Bs.sig || null, stay: !!Bs.sig?.stay, look, emitBase: look.emitK.value, flourish: Bs.flourish || null, blade, emitter: Bs.emitter || null,
      vox: { bone: new Array(cols.length / 3).fill(0), color: new Float32Array(cols) } };
  }
  function build(id) {
    if (models.get(id).beast) return buildBeast(id);
    const M = models.get(id), spec = EmberVoxelKit.get(id), root = new THREE.Group();
    const bones = M.joints.map((j) => { const b = new THREE.Bone(); b.name = j.name; b.position.fromArray(j.t); b.quaternion.fromArray(j.r); b.scale.fromArray(j.s); return b; });
    M.joints.forEach((j, i) => (j.parent >= 0 ? bones[j.parent] : root).add(bones[i]));
    const inv = M.joints.map((_, i) => new THREE.Matrix4().fromArray(M.ibm, i * 16));
    const tint = new THREE.Color(spec.moves?.attack?.tint ?? 0xffd070);
    // a caster works with the hand that holds something (orb, lantern, scepter, astrolabe); the other stays free
    const side = M.hold.L ? "L" : M.hold.R ? "R" : "L", held = M.hold[side];
    const glow = { k: { value: 0 }, c: { value: V3(tint.r, tint.g, tint.b) }, at: { value: new THREE.Vector4(...(held || [0, -9, 0]), 0.09) } };
    if (M.style === "judgment" && M.blade) { const b0 = V3(...M.blade[0]), b1 = V3(...M.blade[1]); glow.at.value.set(...b0.clone().lerp(b1, 0.5).toArray(), b0.distanceTo(b1) * 0.62); }
    const fireCfg = typeof EmberFire !== "undefined" && M.hold[side] ? FIRE[id] : null;
    const B = Object.fromEntries(bones.map((b) => [b.name, b]));
    const weapon = { R: weaponHolder(M, B, inv, "Right"), L: weaponHolder(M, B, inv, "Left") };
    // a signature figure (SUITES[id].sig) with a weapon: the blade (the modelled one, or the far part of the long thing
    // it holds) can light up (the material) and is tracked (the swoosh)
    const sg = SUITES[id]?.sig, wh = weapon.R || weapon.L, from = sg?.bladeFrom ?? 0.35;
    // (the axis found on the held surface — the one the aims use — before the converter's blade, which can take the
    // wrong end of a spear)
    const span = wh ? [wh.userData.fist.clone().addScaledVector(wh.userData.ax, wh.userData.far * from), wh.userData.fist.clone().addScaledVector(wh.userData.ax, wh.userData.far)] : M.blade ? M.blade.map((p) => V3(...p)) : null;
    const lux = sg && span ? { a: { value: span[0] }, b: { value: span[1] }, k: { value: 0 }, t: { value: 0 }, rim: { value: 0 } } : NO_LUX;
    const hit = { value: V3() }, blink = { value: 0 }, dis = disOf(M), mat = material(M, hit, blink, glow, !!fireCfg, lux, dis);
    const mesh = new THREE.SkinnedMesh(M.geo, mat);
    mesh.frustumCulled = false; mesh.layers.set(LAYER);
    root.add(mesh);
    root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones, inv), new THREE.Matrix4());
    // a lit model's outline (the anime look): the same skinned mesh, its back faces pushed out along the normals
    let outline = null;
    if (M.lit) {
      const om = new THREE.MeshBasicMaterial({ color: 0x3a2a1e, side: THREE.BackSide });
      om.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <skinning_vertex>", "#include <skinning_vertex>\n transformed += normalize(objectNormal) * 0.0055;").replace("#include <project_vertex>", "#include <project_vertex>\n gl_Position.z += 0.0015 * gl_Position.w;"); };   // pushed back: only the silhouette shows
      om.customProgramCacheKey = () => "ember-model-outline";
      outline = new THREE.SkinnedMesh(M.geo, om);
      outline.frustumCulled = false; outline.layers.set(LAYER); outline.visible = false;
      root.add(outline); outline.bind(mesh.skeleton, new THREE.Matrix4());
    }
    // the weapon trail's holder: the figure spec's trail runs along its prop's +y from `from` to `to`; put that frame
    // on the model's blade (bind space → the right hand's space)
    const props = [], tr = spec.moves?.attack?.trail, hand = M.joints.findIndex((j) => j.name === "RightHand");
    if (tr?.prop && hand >= 0 && M.blade) {
      const base = V3(...M.blade[0]), tip = V3(...M.blade[1]), dir = tip.clone().sub(base), k = dir.length() / (tr.to[1] - tr.from[1]);
      dir.normalize();
      const H = new THREE.Matrix4().compose(base.clone().addScaledVector(dir, -tr.from[1] * k), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir), V3(k, k, k));
      const holder = new THREE.Object3D();
      inv[hand].clone().multiply(H).decompose(holder.position, holder.quaternion, holder.scale);
      B.RightHand.add(holder);
      props.push({ grip: tr.prop, holder });
    }
    // a caster's emitter (the spec's attack.emitter bone, e.g. "orb"): the centre of what her off hand holds
    const J = {}, em = spec.moves?.attack?.emitter, hn = side === "L" ? "LeftHand" : "RightHand", hi = M.joints.findIndex((j) => j.name === hn);
    if (em?.bone && held && hi >= 0) { const o = new THREE.Object3D(); o.position.fromArray(held).applyMatrix4(inv[hi]); B[hn].add(o); J[em.bone] = o; }
    // (and under one name for every figure: what a move sheet's cast.hand "held" means — a lantern, a loupe, an astrolabe)
    if (held && hi >= 0) { const o = new THREE.Object3D(); o.position.fromArray(held).applyMatrix4(inv[hi]); B[hn].add(o); J.held = o; }
    // the fireball burns where the orb was (at the held thing's centre in the hand)
    let fire = null;
    if (fireCfg && hi >= 0) { fire = EmberFire.ball({ r: fireCfg.r, layer: LAYER }); fire.obj.position.fromArray(held).applyMatrix4(inv[hi]); B[hn].add(fire.obj); }
    // the grip turns the hand about the model's side axis as it was at rest, expressed in the hand's own frame
    const gripAxis = B.RightHand ? V3(1, 0, 0).applyQuaternion(modelQ(B.RightHand, root, new THREE.Quaternion()).invert()).normalize() : null;
    const chestRest = B.Spine2 ? modelQ(B.Spine2, root, new THREE.Quaternion()) : null;
    const headRest = B.Head ? modelQ(B.Head, root, new THREE.Quaternion()) : null;
    const cols = [], uv = M.geo.attributes.uv;
    for (let i = 0; i < uv.count; i += 37) cols.push(...lin(M.data, texel(M, uv.getX(i), uv.getY(i))));
    const fig = { model: true, id, spec, kind: spec.kind, root, mesh, outline, bones: B, J, props, mats: outline ? [mat, outline.material] : [mat], geos: [], hit, blink, glow, dis, gripAxis, M, style: M.style || STYLE[id] || "melee", side,
      rest: bones.map((b) => [b, b.quaternion.clone(), b.position.clone()]),
      vox: { bone: new Array(cols.length / 3).fill(0), color: new Float32Array(cols) }, phase: Math.random() * 6.28,
      spring: { x: 0, vx: 0, z: 0, vz: 0, prev: null, vel: null, T: null }, nextBlink: 1 + Math.random() * 3,
      bonesArr: bones, restQ: bones.map((b) => b.quaternion.clone()), hipH: B.Hips ? B.Hips.position.y : 0, fire, weapon, chestRest, headRest, spell: spellOf(id),
      bladeK: lux.k, bladeT: lux.t, rimK: lux.rim, blade: null, extras: [], inv };
    // the blade's root and point, riding the weapon hand (the swoosh is drawn between them)
    if (span && !M.beast) {                   // every model's weapon is tracked (a plain figure's swoosh too); a signature's lights up
      const hn = wh ? (weapon.R ? "RightHand" : "LeftHand") : "RightHand", hi = M.joints.findIndex((j) => j.name === hn);
      fig.blade = span.map((p) => { const o = new THREE.Object3D(); o.position.copy(p).applyMatrix4(inv[hi]); B[hn].add(o); return o; });
    }
    // its signature choreography (while it plays motion capture): the arena and EmberSkillFx cue on it
    Object.defineProperty(fig, "sig", { get: () => suiteOf(fig)?.sig || null });
    fig.keys = keysFor(fig);
    Object.defineProperty(fig, "stay", { get: () => (fig.style === "judgment" && !fig.sig) || !!fig.sig?.stay });   // the coded judgment and a god strike from where they stand
    return fig;
  }
  /** a caster's spell look (EmberFire): its colour, whether it rises round a god, the sprite's whirl, its wind-up */
  function spellOf(id) {
    const sp = SUITES[id]?.spell;
    if (!sp) return null;
    // (gather false: nothing is drawn into its hand as it charges — its move sheet's cast shows the charge instead)
    return { look: { mode: sp.fire ? "fire" : "energy", tint: sp.tint || [1, 0.5, 0.1] }, rise: !!sp.rise, spin: !!SUITES[id].spin, windup: sp.windup ?? 700, r: sp.r, bolt: sp.bolt, gather: sp.gather !== false };
  }
  /** what a hand holds, if it is long (a sword, a spear, a scythe, a scepter): the principal axis of the held surface
   *  bound to that hand (mt 255, found in bind space), pointing away from the fist toward its far end — a holder on
   *  the hand whose +Y runs along it (aimed by the suites); null for a round thing (an orb) or an empty hand */
  function weaponHolder(M, B, inv, side) {
    const hand = M.joints.findIndex((j) => j.name === side + "Hand"), mt = M.geo.attributes.aMetal?.array;
    if (hand < 0 || !mt || !B[side + "Hand"]) return null;
    const P = M.geo.attributes.position.array, J = M.geo.attributes.skinIndex.array, Wt = M.geo.attributes.skinWeight.array, pts = [];
    for (let i = 0; i < mt.length; i++) {
      if (mt[i] < 253) continue;
      let d = -1, w = -1; for (let k = 0; k < 4; k++) if (Wt[i * 4 + k] > w) { w = Wt[i * 4 + k]; d = J[i * 4 + k]; }
      if (d === hand) pts.push(V3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
    }
    if (pts.length < 30) return null;
    const c = pts.reduce((a, p) => a.add(p), V3()).multiplyScalar(1 / pts.length);
    let ax = V3(0.3, 1, 0.2).normalize();
    for (let it = 0; it < 24; it++) { const n = V3(); for (const p of pts) { const d = p.clone().sub(c); n.addScaledVector(d, d.dot(ax)); } ax = n.normalize(); }
    // long: its length well beyond its typical width (a rag, a crossguard or a scythe's blade stick out; the median
    // width ignores them)
    let lo = Infinity, hi = -Infinity; const wid = [];
    for (const p of pts) { const d = p.clone().sub(c), t = d.dot(ax); lo = Math.min(lo, t); hi = Math.max(hi, t); wid.push(d.addScaledVector(ax, -t).length()); }
    wid.sort((a, b) => a - b);
    if (hi - lo < 6 * wid[wid.length >> 1]) return null;                      // not long: an orb, a lantern body
    const fist = V3().setFromMatrixPosition(inv[hand].clone().invert());
    if (fist.distanceTo(c.clone().addScaledVector(ax, hi)) < fist.distanceTo(c.clone().addScaledVector(ax, lo))) ax.negate();
    const local = ax.clone().transformDirection(inv[hand]);
    const holder = new THREE.Object3D(); holder.quaternion.setFromUnitVectors(V3(0, 1, 0), local);
    let far = 0; for (const p of pts) far = Math.max(far, p.clone().sub(fist).dot(ax));
    holder.userData = { fist, ax: ax.clone(), far };                         // bind space: the fist, along the weapon, to its far end
    B[side + "Hand"].add(holder);
    return holder;
  }
  /** a bone's orientation in the model's space (the chain of its parents' and its own turns up to the figure root) */
  function modelQ(b, root, out) { out.identity(); for (let o = b; o && o !== root; o = o.parent) out.premultiply(o.quaternion); return out; }

  /** its surface in world space at the current pose (a sample of its vertices, their texture colours) — for assembling
   *  and shattering */
  function pointsWorld(fig) {
    fig.root.updateMatrixWorld(true);
    const m = fig.mesh, n = m.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 1400)), uv = m.geometry.attributes.uv;
    const pts = [], cols = [], v = V3();
    for (let i = 0; i < n; i += step) {
      m.applyBoneTransform(i, v.fromBufferAttribute(m.geometry.attributes.position, i)).applyMatrix4(m.matrixWorld);
      pts.push(v.x, v.y, v.z); cols.push(...lin(fig.M.data, texel(fig.M, uv.getX(i), uv.getY(i))));
    }
    return { pts: new Float32Array(pts), cols: new Float32Array(cols), size: 0.024 * fig.root.getWorldScale(V3()).x };
  }

  // ---- clips: bone turns about axes of the model's space, parents before children
  const X = V3(1, 0, 0), Y = V3(0, 1, 0), Z = V3(0, 0, 1), _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _t = new THREE.Quaternion();
  function turn(fig, name, axis, a) {
    const b = fig.bones[name]; if (!b || !a) return;
    modelQ(b.parent, fig.root, _p);
    _q.setFromAxisAngle(axis, a);
    b.quaternion.premultiply(_t.copy(_p).invert().multiply(_q).multiply(_p));
  }
  const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const bell = (x, a, b) => ease((x - a) / 0.5) * (1 - ease((x - b + 0.5) / 0.5));
  /** a pose: raise/fore = weapon arm (out to the side first, clear of the hair) and forearm; grip = the hand's turn from
   *  the resting point-down hold toward a forward grip (negative); twist/lean = torso; step = front-foot lunge;
   *  crouch; guard = shield raised in front; tuck = shield drawn aside */
  const K = (o = {}) => ({ raise: 0, fore: 0, grip: 0, twist: 0, lean: 0, step: 0, crouch: 0, guard: 0, tuck: 0, ...o });
  const mix = (a, b, t) => { const o = {}; for (const k in a) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  function stance(fig, k) {
    const H = fig.bones.Hips;
    if (H) { H.position.y -= 0.022 * k.crouch + 0.012 * k.step; H.position.z += 0.03 * k.step; }
    turn(fig, "RightUpLeg", X, -0.5 * k.step - 0.22 * k.crouch);
    turn(fig, "RightLeg", X, 0.3 * k.step + 0.45 * k.crouch);
    turn(fig, "RightFoot", X, -0.2 * k.crouch);
    turn(fig, "LeftUpLeg", X, 0.35 * k.step - 0.22 * k.crouch);
    turn(fig, "LeftLeg", X, 0.25 * k.step + 0.45 * k.crouch);
    turn(fig, "LeftFoot", X, -0.2 * k.crouch - 0.15 * k.step);
    turn(fig, "Spine", Y, k.twist);
    turn(fig, "Spine1", X, k.lean);
    turn(fig, "Head", X, -k.lean * 0.4);
    turn(fig, "RightArm", Z, -0.55 * Math.min(1, k.raise / 1.2));
    turn(fig, "RightArm", X, -k.raise);
    turn(fig, "RightForeArm", X, -k.fore);
    const tuck = fig.M.noTuck ? 0 : k.tuck;             // only a shield is drawn aside; an empty off hand stays down
    turn(fig, "LeftArm", Z, 0.3 * tuck + 0.12 * k.guard);
    turn(fig, "LeftArm", Y, -0.6 * k.guard);             // swung across the front about the vertical: the shield stays upright
    turn(fig, "LeftArm", X, -0.22 * k.guard);
    if (k.grip && fig.gripAxis) fig.bones.RightHand.quaternion.multiply(_q.setFromAxisAngle(fig.gripAxis, k.grip));
  }
  const REST = K(), COIL = K({ raise: 2.25, fore: 0.95, grip: -1.65, twist: -0.35, lean: -0.12, crouch: 0.6, tuck: 0.8 });
  const STRIKE = K({ raise: 0.3, fore: 0.1, grip: -1.05, twist: 0.32, lean: 0.26, step: 1, crouch: 0.3, tuck: 0.8 });
  // a thrust: the weapon drawn back at the hip, then driven straight forward on a long step
  const T_COIL = K({ raise: 0.6, fore: 1.3, twist: -0.4, lean: -0.1, crouch: 0.5, tuck: 0.6 });
  const T_STRIKE = K({ raise: 1.35, fore: 0.05, twist: 0.35, lean: 0.25, step: 1, crouch: 0.3, tuck: 0.6 });
  // where the weapon should point at each key (model space, +z forward): a chop coils the blade down behind the head
  // and lands it forward and down; a thrust points it forward throughout
  const AIM = { melee: [V3(0, -0.5, -0.85), V3(0, -0.3, 0.95)], thrust: [V3(0, 0.05, 1), V3(0, -0.1, 1)] };
  /** the figure's key poses, the hand's grip turn solved per model so its own weapon points where the key wants it */
  function keysFor(fig) {
    const [c, s] = fig.style === "thrust" ? [T_COIL, T_STRIKE] : [COIL, STRIKE], aim = AIM[fig.style === "judgment" ? "melee" : fig.style];
    const holder = fig.props[0]?.holder;
    if (!aim || !holder || !fig.gripAxis) return { coil: c, strike: s };
    const dir = V3(), solve = (k, want) => {
      let best = 0, bd = -2;
      for (let a = -Math.PI; a < Math.PI; a += 0.05) {
        for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
        stance(fig, { ...k, grip: a }); fig.root.updateMatrixWorld(true);
        dir.set(0, 1, 0).transformDirection(holder.matrixWorld);
        const d = dir.dot(want.clone().normalize()); if (d > bd) { bd = d; best = a; }
      }
      return best;
    };
    const keys = { coil: { ...c, grip: solve(c, aim[0]) }, strike: { ...s, grip: solve(s, aim[1]) } };
    // judgment: the blade straight up over her head, then cut down at the foe
    if (fig.style === "judgment") { keys.raise = { ...RAISE, grip: solve(RAISE, V3(0, 1, 0.12)) }; }
    for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
    fig.root.updateMatrixWorld(true);
    return keys;
  }
  // the hair and cape spring: stiffness, damping, radians per (unit/s²) of the chest's acceleration, limit
  const SPRING = { k: 95, d: 9, gain: 0.006, max: 0.7 };
  function spring(fig, T) {
    const s = fig.spring, chest = fig.bones.Spine2;
    if (!fig.bones.Back || !chest) return;
    const dt = s.T == null ? 0 : Math.min(0.05, T - s.T); s.T = T;
    fig.root.updateMatrixWorld(true);
    const p = chest.getWorldPosition(V3());
    if (!s.prev || dt <= 0 || p.distanceTo(s.prev) > 0.6) { s.prev = p; s.vel = V3(); }
    else {
      const v = p.clone().sub(s.prev).divideScalar(dt), a = v.clone().sub(s.vel).divideScalar(dt);
      s.prev = p; s.vel.lerp(v, 0.6);
      a.applyQuaternion(fig.root.getWorldQuaternion(_t).invert());                      // into the model's space
      const tx = Math.max(-SPRING.max, Math.min(SPRING.max, a.z * SPRING.gain)), tz = Math.max(-SPRING.max, Math.min(SPRING.max, -a.x * SPRING.gain));
      for (let i = 0, n = 4, h = dt / n; i < n; i++) {
        s.vx += (SPRING.k * (tx - s.x) - SPRING.d * s.vx) * h; s.x += s.vx * h;
        s.vz += (SPRING.k * (tz - s.z) - SPRING.d * s.vz) * h; s.z += s.vz * h;
      }
    }
    turn(fig, "Back", X, s.x + 0.02 * Math.sin(T * 1.7 + fig.phase));
    turn(fig, "Back", Z, s.z);
  }
  /** melee: a clip's stance → { done, hop, squeeze } */
  function melee(fig, clip, t) {
    let k = REST, done = true, hop = 0, squeeze = 0;
    if (clip === "attack") {
      const { hit: H, length: L } = C.timing(fig);
      const { coil: CO, strike: ST } = fig.keys;
      if (t < H * 0.72) { const u = t / (H * 0.72); k = mix(REST, CO, ease(u)); k.grip = CO.grip * ease((u - 0.3) / 0.7); }   // the blade rises along the arm, then flips back
      else if (t < H) k = mix(CO, ST, Math.pow((t - H * 0.72) / (H * 0.28), 1.6));
      else if (t < H + 0.1) k = ST;
      else k = mix(ST, REST, ease((t - H - 0.1) / Math.max(0.1, L - H - 0.1)));
      done = t < L;
    } else if (clip === "hurt") {
      const q = Math.pow(Math.max(0, 1 - t / 0.36), 2), up = ease(t / 0.05) * (1 - ease((t - 0.24) / 0.12));
      k = K({ raise: 0.25 * q, fore: 0.2 * q, twist: -0.15 * q, lean: -0.32 * q, crouch: 0.4 * q, guard: up });
      squeeze = up; done = t < 0.36;
    } else if (clip === "victory") {
      const up = ease(t / 0.25) * (1 - ease((t - 1.0) / 0.26));
      k = K({ raise: 2.9 * up, fore: 0.2 * up, lean: -0.08 * up });
      hop = 0.04 * Math.abs(Math.sin((t / 0.42) * Math.PI)) * (t < 0.84 ? 1 : 0);
      done = t < 1.26;
    }
    stance(fig, k);
    return { done, hop, squeeze };
  }
  /** judgment: she stands her ground and thrusts the greatsword straight up — the moment it is high (the contact) the
   *  sword of light slams down on her foe (the arena's attack.smite); she holds it aloft, blazing, while the light
   *  stands in the ground, then lowers it. Victory raises it point-up the same way, with a hop */
  const RAISE = K({ raise: 3.0, fore: 0.3, twist: -0.12, lean: -0.16, crouch: 0.25, guard: 0.35 });
  const DIP = K({ raise: 0.35, fore: 0.6, twist: 0.1, lean: 0.12, crouch: 0.9, guard: 0.5 });
  const JUDGE_HOLD = 1.05;
  function judgment(fig, clip, t, T) {
    const RA = fig.keys.raise;
    if (clip === "victory") {
      const up = ease(t / 0.25) * (1 - ease((t - 1.0) / 0.26));
      stance(fig, mix(REST, RA, up)); fig.glow.k.value = 0.8 * up;
      return { done: t < 1.26, hop: 0.04 * Math.abs(Math.sin((t / 0.42) * Math.PI)) * (t < 0.84 ? 1 : 0), squeeze: 0 };
    }
    if (clip !== "attack") { fig.glow.k.value = 0; return melee(fig, clip, t); }
    const { hit: H } = C.timing(fig), a = H * 0.3, down = H + JUDGE_HOLD, L = down + 0.4;
    let k, charge;
    if (t < a) { const u = ease(t / a); k = mix(REST, DIP, u); k.grip = RA.grip * 0.3 * u; charge = 0.3 * u; }    // gathers low
    else if (t < H) { const u = 1 - Math.pow(1 - (t - a) / (H - a), 2.2); k = mix({ ...DIP, grip: RA.grip * 0.3 }, RA, u); charge = 0.3 + 0.7 * u; }   // thrust up, arriving on the contact
    else if (t < down) { k = { ...RA }; const e = t - H; k.lean -= 0.08 * Math.exp(-e * 6); k.twist += 0.015 * Math.sin(T * 40) * Math.exp(-e * 3); charge = 1; }
    else { const u = ease((t - down) / 0.4); k = mix(RA, REST, u); charge = 1 - u; }
    stance(fig, k);
    fig.glow.k.value = 1.6 * charge * (0.85 + 0.15 * Math.sin(T * 18));
    return { done: t < L, hop: 0, squeeze: 0 };
  }
  /** caster: hovers  /** caster: hovers with its legs hanging, wings fluttering; attack draws the held orb back to the shoulder while it
   *  charges (glow), then thrusts it at the target on the release as the wings beat hard; hurt folds the wings back and
   *  drops her; victory is a spin in the air → { done, hop, squeeze } */
  function caster(fig, clip, t, T) {
    const H = fig.bones.Hips;
    let draw = 0, thrust = 0, lean = 0, fold = 0, beat = 0, spin = 0, up = 0, done = true, squeeze = 0, glow = 0;
    if (clip === "attack") {
      const { hit: Hh, length: L } = C.timing(fig), w = Hh * 0.75;
      if (t < w) { draw = ease(t / w); glow = draw; lean = -0.14 * draw; }
      else if (t < Hh + 0.12) { const q = ease((t - w) / (Hh - w)); draw = 1 - q; thrust = q; lean = -0.14 + 0.34 * q; beat = q; glow = 1 - 0.5 * q; }
      else { const q = ease((t - Hh - 0.12) / Math.max(0.1, L - Hh - 0.12)); thrust = 1 - q; lean = 0.2 * (1 - q); beat = 1 - q; glow = 0.5 * (1 - q); }
      done = t < L;
    } else if (clip === "hurt") {
      const q = Math.pow(Math.max(0, 1 - t / 0.4), 2);
      lean = -0.35 * q; fold = q; up = -0.05 * q; squeeze = ease(t / 0.05) * (1 - ease((t - 0.26) / 0.12)); done = t < 0.4;
    } else if (clip === "victory") {
      spin = ease(t / 0.9); up = 0.08 * Math.sin(Math.min(1, t / 0.9) * Math.PI); beat = 0.6 * (1 - ease((t - 0.9) / 0.3)); done = t < 1.2;
    }
    // a winged caster hovers with its legs hanging and its wings fluttering; one without wings stands
    const flies = !!fig.bones.WingL;
    if (flies) {
      if (H) H.position.y += 0.05 + 0.018 * Math.sin(T * 2.2 + fig.phase) + up;
      const flap = Math.sin(T * (28 + 20 * beat) + fig.phase) * (0.16 + 0.25 * beat), rest = 0.18 + 0.7 * fold - 0.35 * beat;
      turn(fig, "WingL", Y, rest + flap); turn(fig, "WingR", Y, -(rest + flap));
      turn(fig, "WingL", Z, 0.1 * flap); turn(fig, "WingR", Z, -0.1 * flap);
      const d = Math.sin(T * 1.6 + fig.phase);
      turn(fig, "LeftUpLeg", X, -0.12 + 0.06 * d); turn(fig, "LeftLeg", X, 0.35 + 0.08 * d);
      turn(fig, "RightUpLeg", X, 0.05 - 0.06 * d); turn(fig, "RightLeg", X, 0.5 - 0.08 * d);
    } else {
      stance(fig, K({ crouch: 0.35 * draw + 0.5 * fold, step: 0.6 * thrust }));
      if (H) H.position.y += up * 0.4 + 0.03 * Math.sin(Math.min(1, spin) * Math.PI);
    }
    if (spin && H) turn(fig, "Hips", Y, spin * Math.PI * 2);
    turn(fig, "Spine1", X, lean); turn(fig, "Head", X, -lean * 0.5);
    // the casting arm (the hand that holds something): drawn back beside the shoulder, then thrust forward; the other
    // arm opens out. A right-handed caster mirrors the turns
    const m = fig.side === "R" ? -1 : 1, A = fig.side === "R" ? "Right" : "Left", O = fig.side === "R" ? "Left" : "Right";
    // robed casters (wide sleeves and cloaks on the arm) cast with a smaller arm and more body
    const k = fig.M.lit ? (flies ? 1 : 0.85) : (flies ? 1 : 0.55) * (ARM[fig.id] ?? 1);   // a realistic figure's tight sleeves drag nothing
    turn(fig, "Spine", Y, m * (0.35 * draw - 0.3 * thrust) * (flies ? 1 : 1.4));
    turn(fig, A + "Arm", X, (0.9 * draw - 1.35 * thrust) * k);
    turn(fig, A + "Arm", Z, m * (0.45 * draw - 0.35 * thrust) * k);
    turn(fig, A + "ForeArm", X, (-0.5 * draw + 0.85 * thrust) * k);
    // the free arm moves only on winged casters (robed ones drag their cloaks with it)
    if (flies) { turn(fig, O + "Arm", Z, -m * (0.25 * beat + 0.3 * spin * (1 - spin) * 4)); turn(fig, O + "Arm", X, -0.3 * draw); }
    fig.glow.k.value = glow * 1.4;
    return { done, hop: 0, squeeze };
  }
  /** archer: lifts the bow (held across the body in both hands) to eye level at the target, leans into the draw, holds,
   *  and rocks back on the release */
  function archer(fig, clip, t, T) {
    if (clip !== "attack") return melee(fig, clip, t);
    const { hit: Hh, length: L } = C.timing(fig), aimT = Hh * 0.45;
    const aim = t < aimT ? ease(t / aimT) : t < Hh + 0.2 ? 1 : 1 - ease((t - Hh - 0.2) / Math.max(0.1, L - Hh - 0.2));
    const draw = t < aimT ? 0 : t < Hh ? ease((t - aimT) / (Hh - aimT)) : Math.max(0, 1 - (t - Hh) / 0.06);
    const snap = t >= Hh && t < Hh + 0.25 ? Math.sin(((t - Hh) / 0.25) * Math.PI) : 0;
    // the bow is held across the body in both hands (as the model was made): both arms lift it together to eye level,
    // the body leans into the draw and rocks back on the release
    stance(fig, K({ crouch: 0.35 * aim, step: 0.5 * aim, lean: -0.12 * draw + 0.15 * snap }));
    turn(fig, "Spine", Y, 0.25 * aim);
    turn(fig, "Head", X, -0.1 * aim);
    for (const A of ["Left", "Right"]) {
      turn(fig, A + "Arm", X, -0.95 * aim + 0.2 * snap);
      turn(fig, A + "ForeArm", X, -0.35 * aim);
    }
    turn(fig, "RightArm", Z, 0.25 * draw);                        // the string hand opens outward as it draws
    return { done: t < L, hop: 0, squeeze: 0 };
  }
  /** bow (a realistic archer, the bow in the left fist at rest): turns side-on, the bow arm straight out at the target
   *  (the wrist keeps the bow upright), the string hand drawn back to the chin with the elbow high, holds, looses
   *  (the string hand flicks back) and lowers */
  function bow(fig, clip, t, T) {
    if (clip !== "attack") return melee(fig, clip, t);
    const { hit: Hh, length: L } = C.timing(fig), aimT = Hh * 0.4;
    const aim = t < aimT ? ease(t / aimT) : t < Hh + 0.25 ? 1 : 1 - ease((t - Hh - 0.25) / Math.max(0.1, L - Hh - 0.25));
    const draw = t < aimT * 0.6 ? 0 : t < Hh ? ease((t - aimT * 0.6) / (Hh - aimT * 0.6)) : Math.max(0, 1 - (t - Hh) / 0.05);
    const snap = t >= Hh && t < Hh + 0.3 ? Math.sin(((t - Hh) / 0.3) * Math.PI) : 0;
    stance(fig, K({ crouch: 0.3 * aim, lean: -0.05 * aim + 0.08 * snap }));
    turn(fig, "Spine", Y, -0.75 * aim); turn(fig, "Spine1", Y, -0.2 * aim);
    turn(fig, "Head", Y, 0.8 * aim);
    turn(fig, "LeftArm", X, -1.5 * aim); turn(fig, "LeftArm", Y, 0.55 * aim);
    turn(fig, "LeftForeArm", X, 0.2 * aim);
    turn(fig, "LeftHand", X, 1.3 * aim);
    turn(fig, "RightArm", X, -1.45 * aim); turn(fig, "RightArm", Y, (-0.2 - 0.45 * draw) * aim);
    turn(fig, "RightForeArm", Y, (1.6 + 0.9 * draw - 0.5 * snap) * aim);
    return { done: t < L, hop: 0, squeeze: 0 };
  }
  // ---- motion-captured clips (EmberModelAnims, tools/anim_art.mjs): a figure with a suite plays them instead of its
  // coded clips. Each clip frame holds every bone's world turn away from the T-pose (D); on the figure a bone's world
  // rotation is D · its own T-pose rotation (M.tq), made local to its animated parent. Bones a clip leaves alone
  // (fingers round the fist, the hair / cape "Back", wings) keep their rest relative to their parent. Attacks run
  // faster than captured (mocap reads slow at this scale); the contact frame is the clip's, the stage times the
  // director's contact to it (C.timing below). A new clip blends in from the pose the figure was in.
  // Each figure's suite is chosen for who it is (docs/design/MINIATURES.md): its weapon, its bearing, its temper.
  //   aimUp: in that clip the weapon's point turns to the sky as the weapon hand rises above the head (a clip made
  //   for an open hand holds a blade flat) · aim: { clip: [x, y, z] } the point held that way (figure space) all
  //   through the clip · hover: it floats, legs hanging, wings beating · speed: × the clip speeds (a mountain is slow)
  //   Clips ending in _m are Mixamo's mirror (the caster works with the left hand, where its focus is)
  //   aim: { clip: "up" | "target" | "foe" | "raised" | [x, y, z] } where the weapon points (see aimFor) · lower: clips whose
  //   legs are the idle's (a kneel, a leap or the splits would not suit the figure) · face: the chest turns to the foe
  //   as the blow lands (casting clips turn aside) · upright: clips whose back, neck and head are the idle's too (a
  //   caster stands tall and casts with the arms; a god never stoops) · float: a god hovers that high · spin: a
  //   sprite whirls as it gathers · spell: its charge and bolt (EmberFire): tint or fire, rise (a column of light
  //   round a god), windup (ms of charging before the release), bolt (its size) · stance: the clip upright/lower take the
  //   body from (else the idle; with it the idle itself can be upright: its arms, the stance's body) · bow: an archer
  //   turns so the arrow (string hand → bow hand) points at the foe
  //   sig: a signature choreography, authored pose to pose the way a MOBA champion's moves are (the capture is the
  //   reference, the timing is drawn):
  //     lead (ms to the blow) · windup (how much longer than the director's plain lunge; an archer: draw)
  //     pre [[share of the lead, clip frame, ease into it] …] the coil, the beat held, the spring, the blade down
  //     post [[seconds after the blow, frame, ease] …] the landing, held · rise / back (s): up into the stance, the
  //     hop home · leap (the share of the lead when its feet leave the ground) · dash leap (even through the air) |
  //     lunge (late and fast) · stay (it strikes from where it stands) · levitate · reach (× its size: where it
  //     lands short of the foe) · hitstop (frames the blow holds it, by tier) · hipScale · bladeFrom · flourish
  //     { clip, every [s, s], keys, fade } (at rest, now and then) · fx (its effects: EmberSkillFx) · plain (what
  //     the signature replaced: the model demo compares)
  //   Written in the move sheets (content/moves.js: named phases in ms, effects by the moment they play, archetypes) and
  //   compiled into this table by EmberMoveSheet — tune a figure there, never here.
  const SUITES = {};
  /** the suites and the beasts' signatures, compiled from the sheets as they are now (the review page calls this
   *  again after it reloads content/moves.js; a figure built before then keeps what it was built with) */
  function loadSheets() {
    const T = { SUITES: EmberMoveSheet.SUITES, BEASTS: EmberMoveSheet.BEASTS };
    for (const [table, from] of [[SUITES, T.SUITES], [BEASTS, T.BEASTS]]) { for (const k of Object.keys(table)) delete table[k]; Object.assign(table, from); }
  }
  loadSheets();
  const SPEED = { attack: 1.35, hurt: 1.2, victory: 1.1, idle: 1 }, BLEND = 0.18, BLEND_IDLE = 0.5;
  const clips = new Map();
  function clipData(name) {
    if (clips.has(name)) return clips.get(name);
    const A = typeof EmberModelAnims !== "undefined" && EmberModelAnims[name];
    let out = null;
    // "<clip>@m": the clip mirrored left for right (a lantern-bearer casts with the free hand): each side's bones take
    // the other side's turns reflected through the body's midplane (x, y, z, w → x, −y, −z, w), the hips' sway reversed
    if (name.endsWith("@m")) {
      const B = clipData(name.slice(0, -2));
      if (B) {
        const q = Float32Array.from(B.q), hip = Float32Array.from(B.hip);
        for (let i = 0; i < q.length; i += 4) { q[i + 1] = -q[i + 1]; q[i + 2] = -q[i + 2]; }
        for (let i = 0; i < hip.length; i += 3) hip[i] = -hip[i];
        out = { ...B, q, hip, bones: B.bones.map((n) => (/^Left/.test(n) ? n.replace(/^Left/, "Right") : n.replace(/^Right/, "Left"))) };
      }
    } else if (EmberMoveSheet.CHAINS?.[name]) {
      // a chain: stretches of clips one after another, each eased in over `blend` frames from where the last one ended
      const ch = EmberMoveSheet.CHAINS[name], parts = ch.parts.map(([c, f0, f1]) => ({ c: clipData(c), f0, f1 })).filter((x) => x.c), bl = ch.blend ?? 7;
      if (parts.length === ch.parts.length) {
        const bones = parts[0].c.bones, nb = bones.length, n = parts.reduce((k, x) => k + x.f1 - x.f0 + 1, 0), q = new Float32Array(n * nb * 4), hip = new Float32Array(n * 3);
        const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
        let at = 0;
        parts.forEach((x, pi) => {
          const map = bones.map((b) => x.c.bones.indexOf(b)), xn = x.c.bones.length;
          for (let f = x.f0; f <= x.f1; f++, at++) {
            const w = pi > 0 && f - x.f0 < bl ? ease((f - x.f0 + 1) / (bl + 1)) : 1;
            for (let b = 0; b < nb; b++) {
              const o = (at * nb + b) * 4, src = map[b] >= 0 ? (f * xn + map[b]) * 4 : -1;
              if (src >= 0) qb.set(x.c.q[src], x.c.q[src + 1], x.c.q[src + 2], x.c.q[src + 3]); else qb.identity();
              if (w < 1) { const pv = ((at - (f - x.f0) - 1) * nb + b) * 4; qa.set(q[pv], q[pv + 1], q[pv + 2], q[pv + 3]); qb.copy(qa.slerp(qb, w)); }
              q[o] = qb.x; q[o + 1] = qb.y; q[o + 2] = qb.z; q[o + 3] = qb.w;
            }
            for (let c = 0; c < 3; c++) { const v = x.c.hip[f * 3 + c]; hip[at * 3 + c] = w < 1 ? hip[(at - (f - x.f0) - 1) * 3 + c] * (1 - w) + v * w : v; }
          }
        });
        out = { n, fps: 30, bones, loop: false, hit: null, q, hip };
      }
    } else if (CODED[name]) {
      // a coded move (EmberMoveSheet.CODED: its frames, its contact, the motion-captured clip under it if any)
      const c = EmberMoveSheet.CODED?.[name] || {};
      out = { n: c.n ?? 31, fps: 30, bones: [], loop: false, hit: c.hit, q: new Float32Array(0), hip: new Float32Array(0), coded: CODED[name], base: c.base || null };
    } else if (A) {
      const raw = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer;
      const q = new Int16Array(raw(A.q)), hp = new Int16Array(raw(A.hip));
      out = { n: A.n, fps: A.fps, bones: A.bones, loop: !!A.loop, hit: A.hit, q: Float32Array.from(q, (v) => v / 32767), hip: Float32Array.from(hp, (v) => v / 10000) };
    }
    clips.set(name, out);
    return out;
  }
  const MOCAP = { on: true, sig: true };       // the model demo switches back to the coded clips (or a signature to its plain suite) to compare
  const plainOf = (s) => s.plainSuite || (s.plainSuite = { ...s, ...s.plain, sig: null });
  const suiteOf = (fig) => { const s = MOCAP.on && fig.M.tq && !fig.M.beast && SUITES[fig.id]; return !s ? null : s.sig && !MOCAP.sig ? plainOf(s) : s; };
  /** the clip's timing on the figure (seconds): contact and length, played at SPEED (a signature: its lead, then the
   *  landing, the rise and the hop home) */
  function clipTiming(fig) {
    const sg = fig.sig;
    if (sg) { const H = sg.lead / 1000; return { hit: H, length: H + sg.post[sg.post.length - 1][0] + sg.rise + sg.back }; }
    const A = clipData(suiteOf(fig).attack), k = SPEED.attack * (suiteOf(fig).speed ?? 1);
    return { hit: (A.hit ?? A.n * 0.45) / A.fps / k, length: (A.n - 1) / A.fps / k };
  }
  // the eases a signature's keys name: io in-out · o out (fast, then settling) · i3 in (slow, then fast: a strike)
  const EASES = { io: ease, o: (x) => 1 - (1 - x) * (1 - x), o3: (x) => 1 - Math.pow(1 - x, 3), i2: (x) => x * x, i3: (x) => x * x * x, l: (x) => x };
  /** keys [[x, frame, ease], …] → the clip frame at x */
  function keyed(keys, x) {
    if (x <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const [x0, f0] = keys[i - 1], [x1, f1, e] = keys[i]; return f0 + (f1 - f0) * (EASES[e] || EASES.l)((x - x0) / (x1 - x0)); }
    return keys[keys.length - 1][1];
  }
  const _a = new THREE.Quaternion(), _b = new THREE.Quaternion(), _w = new THREE.Quaternion();
  /** frame: play that frame of the clip (a signature's re-timed keys) instead of the clip's own clock */
  function playClip(fig, clip, name, t, T, frame = null) {
    const A = clipData(name); if (!A) return null;
    const k = (SPEED[clip] ?? 1) * (suiteOf(fig)?.speed ?? 1), last = A.n - 1;
    let u = frame != null ? Math.min(last, Math.max(0, frame)) : clip === "idle" ? ((T + fig.phase * 3) * A.fps) % last : Math.min(last, t * A.fps * k);
    if (A.coded) {
      // under it: the motion-captured clip it reshapes, frame for frame — or the stance, breathing on
      const suite = suiteOf(fig);
      if (A.base) playClip(fig, clip, A.base, t, T, Math.min(u, clipData(A.base).n - 1)); else playClip(fig, "idle", suite?.stance || suite?.idle, 0, T);
      A.coded(fig, u, T);
      fig.glow.k.value = 0;
      return clip === "idle" || u < last || (clip === "victory" && t < 1.6);
    }
    const f0 = Math.floor(u), f1 = Math.min(last, f0 + 1), fr = u - f0;
    // per bone: the clip's world turn for this frame
    const idxs = fig.clipIdxs || (fig.clipIdxs = new Map());         // (per clip: a blend plays two a frame)
    if (!idxs.has(name)) idxs.set(name, { name, of: A.bones.map((nm) => fig.M.joints.findIndex((j) => j.name === nm)) });
    fig.clipIdx = idxs.get(name);
    const W = fig.worldQ || (fig.worldQ = fig.M.joints.map(() => new THREE.Quaternion()));
    // (the clip's turns go into arrays kept on the figure: posing allocates nothing, frame after frame)
    const D = fig.clipQ || (fig.clipQ = fig.M.joints.map(() => new THREE.Quaternion())), has = fig.clipHas || (fig.clipHas = new Uint8Array(fig.M.joints.length));
    has.fill(0);
    fig.clipIdx.of.forEach((ji, k2) => {
      if (ji < 0 || !fig.M.tq[ji]) return;
      const o0 = (f0 * A.bones.length + k2) * 4, o1 = (f1 * A.bones.length + k2) * 4;
      _a.set(A.q[o0], A.q[o0 + 1], A.q[o0 + 2], A.q[o0 + 3]); _b.set(A.q[o1], A.q[o1 + 1], A.q[o1 + 2], A.q[o1 + 3]);
      D[ji].copy(_a).slerp(_b, fr); has[ji] = 1;
    });
    fig.bonesArr.forEach((b, i) => {
      const p = fig.M.joints[i].parent, pw = p >= 0 ? W[p] : _w.identity();
      if (has[i]) W[i].copy(D[i]).multiply(_a.fromArray(fig.M.tq[i]));
      else W[i].copy(pw).multiply(fig.restQ[i]);
      b.quaternion.copy(p >= 0 ? W[p] : _b.identity()).invert().multiply(W[i]);
    });
    // the hips rise and sink with the clip; they do not travel (the stage moves the figure)
    const H = fig.bones.Hips;
    if (H) { const o0 = f0 * 3, o1 = f1 * 3, dy = A.hip[o0 + 1] + (A.hip[o1 + 1] - A.hip[o0 + 1]) * fr; H.position.y += dy * fig.hipH * (clip === "attack" ? suiteOf(fig)?.sig?.hipScale ?? 1 : 1); }
    const done = clip === "idle" || u < last || (clip === "victory" && t < 1.6);      // a victory pose is held a while
    if (fig.style === "judgment" && clip === "attack" && A.hit != null && !fig.sig) { const h = A.hit; fig.glow.k.value = 1.6 * (u < h ? ease(u / h) : Math.max(0, 1 - (u - h) / (A.fps * 0.5))); }
    else fig.glow.k.value = 0;
    return done;
  }
  /** a signature attack: its clip played through its keys — the lead (t ≤ H, which the arena stretches onto the
   *  director's contact), then the landing in real seconds — then risen into the idle stance (fast off the knee,
   *  settling), which it keeps for the hop home → false once it is home */
  function sigAttack(fig, suite, t, T) {
    const sg = suite.sig, H = sg.lead / 1000, P = sg.post[sg.post.length - 1][0];
    if (t <= H + P) { playClip(fig, "attack", suite.attack, t, T, t <= H ? keyed(sg.pre, t / H) : keyed(sg.post, t - H)); return true; }
    playClip(fig, "attack", suite.attack, t, T, sg.post[sg.post.length - 1][1]);
    blendOver(fig, () => playClip(fig, "idle", suite.idle, 0, T), EASES.o3(Math.min(1, (t - H - P) / sg.rise)));
    return t < H + P + sg.rise + sg.back;
  }
  /** a signature at rest: its idle, and every so often its flourish (a salute, a taunt, a roar) blended over it */
  function sigIdle(fig, suite, t, T) {
    playClip(fig, "idle", suite.idle, t, T);
    const sa = suite.sig.flourish; if (!sa) return true;
    const D = sa.keys[sa.keys.length - 1][0];
    if (fig.flourish == null || T < fig.flourish - 60) fig.flourish = T + sa.every[0] * 0.5 + Math.random() * 3;     // a new figure waits a while first
    const s = T - fig.flourish;
    if (s > D) fig.flourish = T + sa.every[0] + Math.random() * (sa.every[1] - sa.every[0]);
    else if (s >= 0) blendOver(fig, () => playClip(fig, "idle", sa.clip, s, T, keyed(sa.keys, s)), ease(s / sa.fade[0]) * (1 - ease((s - D + sa.fade[1]) / sa.fade[1])));
    return true;
  }
  /** the pose the bones hold now, moved toward the pose `play` makes by w (the hips' height too) */
  function blendOver(fig, play, w) {
    if (w <= 0) return;
    const from = fig.bonesArr.map((b) => b.quaternion.clone()), hy = fig.bones.Hips?.position.y;
    for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
    play();
    if (w >= 1) return;
    fig.bonesArr.forEach((b, i) => { _w.copy(b.quaternion); b.quaternion.copy(from[i]).slerp(_w, w); });
    if (hy != null) fig.bones.Hips.position.y += (hy - fig.bones.Hips.position.y) * (1 - w);
  }
  /** the weapon's point turned to the sky, as much as the weapon hand is raised above the head (a clip made for an
   *  open hand holds a blade flat) */
  const _v = V3(), _u = V3(), _h = V3();
  function aimUp(fig) {
    const side = fig.weapon.R ? "R" : "L", hand = fig.bones[side === "R" ? "RightHand" : "LeftHand"], head = fig.bones.Head;
    if (!hand || !head) return;
    fig.root.updateMatrixWorld(true);
    const s = fig.root.getWorldScale(_h).y || 1;
    const w = ease((hand.getWorldPosition(_v).y - head.getWorldPosition(_u).y) / s / 0.12);
    if (w > 0) aimBlade(fig, V3(0.08, 1, 0.12), w, side);
  }
  /** turn the weapon hand so the weapon's point goes along dir (figure space), by w */
  function aimBlade(fig, dir, w, side = fig.weapon.R ? "R" : "L") {
    const S = side === "R" ? "Right" : "Left", hand = fig.bones[S + "Hand"], fore = fig.bones[S + "ForeArm"], holder = fig.weapon[side] || (side === "R" ? fig.props[0]?.holder : null);
    if (!hand || !holder || w <= 0) return;
    fig.root.updateMatrixWorld(true);
    const want = dir.clone().normalize().applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion()));
    const cur = V3(0, 1, 0).transformDirection(holder.matrixWorld);
    // the roll of the forearm (about its own axis) that brings the weapon nearest the aim, sparing the wrist — then the
    // wrist's bend for what is left, no more than a wrist bends (wristCare shares the roll out along the forearm)
    let q = new THREE.Quaternion().setFromUnitVectors(cur, want);
    if (fore) {
      const f = hand.getWorldPosition(V3()).sub(fore.getWorldPosition(V3())).normalize(), r = new THREE.Quaternion(), c = V3();
      // (two rolls can serve an aim almost equally, and the nearer one changes from frame to frame: the roll keeps to
      // the one it had and turns toward a new one at a wrist's pace — never a flip of the blade in one frame)
      const was = fig.aimRoll?.[side], held = was && fig.nowT != null && fig.nowT >= was.T && fig.nowT - was.T < 0.12 ? was : null;
      let best = 0, bd = Infinity;
      for (let a = -1.9; a <= 1.9; a += 0.1) { c.copy(cur).applyQuaternion(r.setFromAxisAngle(f, a)); const d = c.angleTo(want) + 0.25 * Math.abs(a) + (held ? 0.2 * Math.abs(a - held.a) : 0); if (d < bd) { bd = d; best = a; } }
      if (held) { const step = fig.nowT === held.T ? 0 : 9 * (fig.nowT - held.T); best = held.a + Math.max(-step, Math.min(step, best - held.a)); }
      if (fig.nowT != null) (fig.aimRoll ||= {})[side] = { a: best, T: fig.nowT };
      const roll = new THREE.Quaternion().setFromAxisAngle(f, best), rolled = cur.clone().applyQuaternion(roll);
      const bend = new THREE.Quaternion().setFromUnitVectors(rolled, want), ang = rolled.angleTo(want);
      if (ang > WRIST.swing) bend.slerp(new THREE.Quaternion(), 1 - WRIST.swing / ang).normalize();   // (slerp toward identity by the excess)
      q = bend.multiply(roll);
    }
    const qi = new THREE.Quaternion().slerp(q, Math.min(1, w));
    const hw = hand.getWorldQuaternion(new THREE.Quaternion()), pw = hand.parent.getWorldQuaternion(new THREE.Quaternion());
    hand.quaternion.copy(pw.invert().multiply(qi.multiply(hw)));
  }
  /** hands kept anatomical (after everything else has posed them), the hand's place in the world — and so what it
   *  holds, and where that points — unchanged: a wrist bends no further than a wrist can (the rest of the bend is taken
   *  at the shoulder, which turns the whole arm), and a hand does not twist against its forearm — the forearm rolls —
   *  so most of any twist a clip, an aim or a retarget put at the wrist goes up the forearm (the skin twists along the
   *  arm instead of wringing at the wrist) */
  const WRIST = { swing: 1.05, twist: 0.6, share: 0.65, on: true };
  const _pw = new THREE.Quaternion(), _fw = new THREE.Quaternion(), _g = new THREE.Quaternion(), _x = new THREE.Quaternion();
  const _e = new THREE.Quaternion(), _tw = new THREE.Quaternion(), _sw = new THREE.Quaternion(), _tf = new THREE.Quaternion(), _th = new THREE.Quaternion(), _ri = new THREE.Quaternion(), _ax = V3();
  function wristCare(fig) {
    if (!WRIST.on) return;
    fig.handIdx ||= { Left: fig.bonesArr.indexOf(fig.bones.LeftHand), Right: fig.bonesArr.indexOf(fig.bones.RightHand) };
    for (const S of ["Left", "Right"]) {
      const H = fig.bones[S + "Hand"], F = fig.bones[S + "ForeArm"], i = fig.handIdx[S];
      if (!H || !F || i < 0) continue;
      const R = fig.restQ[i];
      _e.copy(H.quaternion).multiply(_ri.copy(R).invert());                    // H = e · R: the hand's turn off its rest, in the forearm's frame
      _ax.copy(H.position).normalize();                                        // the forearm's own axis (toward the wrist)
      const d = _ax.x * _e.x + _ax.y * _e.y + _ax.z * _e.z;
      _tw.set(_ax.x * d, _ax.y * d, _ax.z * d, _e.w);
      if (_tw.lengthSq() < 1e-10) _tw.identity(); else _tw.normalize();
      _sw.copy(_e).multiply(_ri.copy(_tw).invert());                           // e = swing · twist
      const ang = 2 * Math.acos(Math.min(1, Math.abs(_sw.w))), A = fig.bones[S + "Arm"];
      if (ang > WRIST.swing && A && fig.reached !== S) {    // (an arm a reach has placed stays where it was put)
        // the excess, turned in the world at the shoulder: g = Fw · x · Fw⁻¹ (x the excess in the forearm's frame)
        _x.identity().slerp(_sw, 1 - WRIST.swing / ang);
        _sw.copy(_x).invert().multiply(_ri.copy(_e).multiply(_th.copy(_tw).invert()));       // the swing kept (x⁻¹ · swing)
        modelQ(F, fig.root, _fw); _g.copy(_fw).multiply(_x).multiply(_ri.copy(_fw).invert());
        modelQ(A.parent, fig.root, _pw);
        A.quaternion.premultiply(_ri.copy(_pw).invert().multiply(_g).multiply(_pw));
      }
      let th = 2 * Math.atan2(_ax.x * _tw.x + _ax.y * _tw.y + _ax.z * _tw.z, _tw.w);
      th = Math.atan2(Math.sin(th), Math.cos(th));
      // the wrist keeps a little of the twist (never more than it can), the forearm rolls the rest
      const wr = Math.max(-WRIST.twist, Math.min(WRIST.twist, th * (1 - WRIST.share)));
      _tf.setFromAxisAngle(_ax, th - wr); _th.setFromAxisAngle(_ax, wr);
      F.quaternion.multiply(_tf);
      H.quaternion.copy(_ri.copy(_tf).invert()).multiply(_sw).multiply(_tf).multiply(_th).multiply(R);
    }
  }
  // the suite's aim for a clip: "up" (point to the sky) · "target" (at the foe, from the wind-up through the blow) ·
  // "raised" (to the sky as the weapon hand rises above the head) · [x, y, z] (held that way in figure space)
  const POINT = { up: V3(0.05, 1, 0.1), target: V3(0, -0.08, 1) };
  function aimFor(fig, suite, clip, t) {
    const a = suite.aim?.[clip] ?? (suite.aimUp === clip ? "raised" : null);
    if (!a) return;
    if (a === "raised") return aimUp(fig);
    // strike: the blade driven down into the ground on the blow, held there through the landing, lifted with the rise
    if (a === "strike") {
      const h = C.timing(fig).hit, sg = suite.sig, P = sg ? sg.post[sg.post.length - 1][0] : 0.3, r = sg?.rise ?? 0.3;
      return aimBlade(fig, V3(0, -0.85, 0.5), t < h * 0.85 ? 0 : t < h ? ease((t - h * 0.85) / (h * 0.15)) : t < h + P ? 1 : 1 - ease((t - h - P) / r));
    }
    if (a === "target") {
      const h = C.timing(fig).hit, w = t < h ? ease((t - h * 0.4) / (h * 0.6)) : 1 - ease((t - h - 0.3) / 0.35);
      return aimBlade(fig, POINT.target, w);
    }
    // foe: at its foe's body as the blow lands (the arena says where that is: fig.foeAt) — a tall figure's level cut
    // passes over a small foe's head; this brings the last of the swing down (or up) onto it, and lets go after
    if (a === "foe") {
      const hand = fig.bones[fig.weapon.R ? "RightHand" : "LeftHand"];
      if (!fig.foeAt || !hand) return;
      const h = C.timing(fig).hit, w = t < h ? ease((t - h * 0.7) / (h * 0.3)) : 1 - ease((t - h - 0.1) / 0.3);
      if (w <= 0) return;
      fig.root.updateMatrixWorld(true);
      const dir = fig.foeAt.clone().sub(hand.getWorldPosition(V3())).applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion()).invert());
      return aimBlade(fig, dir, w);
    }
    aimBlade(fig, Array.isArray(a) ? V3(...a) : POINT[a], 1);
  }
  const LOWER = /^(Hips|LeftUpLeg|LeftLeg|LeftFoot|LeftToeBase|RightUpLeg|RightLeg|RightFoot|RightToeBase)$/;
  const UPRIGHT = /^(Hips|LeftUpLeg|LeftLeg|LeftFoot|LeftToeBase|RightUpLeg|RightLeg|RightFoot|RightToeBase|Spine|Spine1|Spine2|Neck|Head)$/;
  // keep: { clip: "Left" | "Right" } — that arm as the stance holds it (what it carries stays steady)
  const ARMS = { Left: /^Left(Shoulder|Arm|ForeArm|Hand)$/, Right: /^Right(Shoulder|Arm|ForeArm|Hand)$/ };
  /** the legs and hips (and with UPRIGHT the back, neck and head) as the idle has them: a clip's kneel, leap, splits
   *  or stoop would not suit the figure; its arms still do what the clip does */
  function lowerFromIdle(fig, suite, t, T, LOWER) {
    for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
    playClip(fig, "idle", suite.stance || suite.idle, 0, T);
    const keep = fig.bonesArr.map((b) => (LOWER.test(b.name) ? b.quaternion.clone() : null)), hy = fig.bones.Hips?.position.y;
    return () => { fig.bonesArr.forEach((b, i) => keep[i] && b.quaternion.copy(keep[i])); if (hy != null) fig.bones.Hips.position.y = hy; };
  }
  /** the attack's envelope for turning to the foe: in over the wind-up (a sprite's after its whirl), held through
   *  the contact, out after */
  function toFoe(fig, suite, t) {
    const h = C.timing(fig).hit, a = suite.spin ? h * 0.8 : 0;
    return Math.min(ease((t - a) / Math.max(0.12, (h - a) * 0.6)), 1 - ease((t - h - 0.3) / 0.4));
  }
  const yawOf = (v) => Math.atan2(v.x, v.z);
  /** turn the whole body (about the hips) so the line that carries the attack points at the foe (+z): an archer's
   *  arrow (string hand → bow hand), a caster's casting arm (shoulder → hand; a hand raised straight up says little,
   *  then the chest), anyone else's chest */
  function faceTarget(fig, suite, t) {
    const w = toFoe(fig, suite, t);
    if (w <= 0 || !fig.bones.Hips) return;
    fig.root.updateMatrixWorld(true);
    const P = (n) => fig.bones[n].getWorldPosition(V3()), inv = fig.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    let line = null, arm = null;
    const chest = fig.chestRest && fig.bones.Spine2 ? V3(0, 0, 1).applyQuaternion(fig.chestRest.clone().invert()).applyQuaternion(modelQ(fig.bones.Spine2, fig.root, new THREE.Quaternion())) : null;
    if (suite.bow && fig.bones.LeftHand) line = P("LeftHand").sub(P("RightHand"));          // an archer stands side-on
    else if (fig.spec.moves?.attack?.ranged) { const S = (suite.castSide || fig.side) === "L" ? "Left" : "Right"; if (fig.bones[S + "Hand"]) { line = P(S + "Hand").sub(P(S + "Arm")); arm = S + "Arm"; } }
    if (line) { line.applyQuaternion(inv); if (Math.hypot(line.x, line.z) < 0.35 * line.length()) { line = null; arm = null; } }
    if (!line) line = chest;
    if (!line) return;
    const l = yawOf(line);
    if (!arm || !chest) { turn(fig, "Hips", Y, -l * w); return; }
    // a caster turns its body only so far (its chest within 35° of the foe); the casting arm swings the rest at the
    // shoulder, so it casts at the foe without turning its back
    const c = yawOf(chest), body = Math.max(c - 0.61, Math.min(c + 0.61, l));
    turn(fig, "Hips", Y, -body * w);
    turn(fig, arm, Y, -(l - body) * w);
  }
  /** the eyes on the foe: neck and head turned (up to ~70°) so the face points at +z */
  function lookAtFoe(fig, suite, t) {
    const w = toFoe(fig, suite, t);
    if (w <= 0 || !fig.headRest || !fig.bones.Head) return;
    fig.root.updateMatrixWorld(true);
    const f = V3(0, 0, 1).applyQuaternion(fig.headRest.clone().invert()).applyQuaternion(modelQ(fig.bones.Head, fig.root, new THREE.Quaternion()));
    const e = Math.max(-1.2, Math.min(1.2, yawOf(f))) * w;
    turn(fig, "Neck", Y, -0.4 * e); turn(fig, "Head", Y, -0.6 * e);
  }
  /** a winged figure floats: the hips lifted and bobbing, the legs hanging loose (whatever the clip's feet did), the
   *  wings beating — faster as it casts */
  function hover(fig, clip, t, T) {
    const H = fig.bones.Hips; if (!H) return;
    const beat = clip === "attack" ? 1 : 0;
    H.position.y += fig.hipH * ((typeof fig.suite?.hover === "number" ? fig.suite.hover : 0.07) + 0.025 * Math.sin(T * 2.2 + fig.phase));
    fig.bonesArr.forEach((b, i) => { if (/UpLeg$|Leg$|Foot$|ToeBase$/.test(b.name)) b.quaternion.copy(fig.restQ[i]); });
    const d = Math.sin(T * 1.6 + fig.phase);
    turn(fig, "LeftUpLeg", X, -0.12 + 0.06 * d); turn(fig, "LeftLeg", X, 0.35 + 0.08 * d);
    turn(fig, "RightUpLeg", X, 0.05 - 0.06 * d); turn(fig, "RightLeg", X, 0.5 - 0.08 * d);
    const flap = Math.sin(T * (28 + 20 * beat) + fig.phase) * (0.16 + 0.25 * beat), rest = 0.18 - 0.35 * beat;
    turn(fig, "WingL", Y, rest + flap); turn(fig, "WingR", Y, -(rest + flap));
  }
  // ---- reaching: limbs put where a move wants them (two-bone IK in the figure's own space: +z toward its foe, +y up,
  // its left +x), over whatever clip is playing — a coded move's fists and feet, a thing carried in front of the body
  const at = (fig, b) => fig.root.worldToLocal(b.getWorldPosition(V3()));
  const _mq = new THREE.Quaternion(), _mp = new THREE.Quaternion();
  /** the bone turned (about itself) so the line from it to `child` runs along `want` (figure space) */
  function aimBone(fig, bone, child, want) {
    fig.root.updateMatrixWorld(true);
    const a = at(fig, bone), cur = at(fig, child).sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(cur, want.clone().normalize());
    modelQ(bone, fig.root, _mq); modelQ(bone.parent, fig.root, _mp);
    bone.quaternion.copy(_mp.invert().multiply(q.multiply(_mq)));
  }
  /** a bone given this orientation in the figure's space (a foot kept flat while its leg bends) */
  function setModelQ(fig, bone, q) { modelQ(bone.parent, fig.root, _mp); bone.quaternion.copy(_mp.invert().multiply(q)); }
  /** upper → lower → end reaches `target` (figure space), the joint between them bent toward `pole` (a direction); w < 1
   *  goes only part of the way from where the clip had them */
  function reach(fig, upper, lower, end, target, pole, w = 1) {
    if (w <= 0 || !upper || !lower || !end) return;
    const was = w < 1 ? [upper.quaternion.clone(), lower.quaternion.clone()] : null;
    fig.root.updateMatrixWorld(true);
    const A = at(fig, upper), la = A.distanceTo(at(fig, lower)), lb = at(fig, lower).distanceTo(at(fig, end));
    const d0 = target.clone().sub(A), d = Math.max(Math.abs(la - lb) + 1e-3, Math.min((la + lb) * 0.995, d0.length())), dir = d0.normalize();
    const x = (la * la - lb * lb + d * d) / (2 * d), h = Math.sqrt(Math.max(0, la * la - x * x));
    const pd = pole.clone().addScaledVector(dir, -pole.dot(dir));
    if (pd.lengthSq() < 1e-6) pd.set(0, -1, 0).addScaledVector(dir, dir.y);
    const E = A.clone().addScaledVector(dir, x).addScaledVector(pd.normalize(), h);
    aimBone(fig, upper, lower, E.clone().sub(A));
    aimBone(fig, lower, end, A.clone().addScaledVector(dir, d).sub(E));
    if (was) { upper.quaternion.copy(was[0].slerp(upper.quaternion, w)); lower.quaternion.copy(was[1].slerp(lower.quaternion, w)); }
  }
  const armLen = (fig, S) => { const B = fig.bones; return at(fig, B[S + "Arm"]).distanceTo(at(fig, B[S + "ForeArm"])) + at(fig, B[S + "ForeArm"]).distanceTo(at(fig, B[S + "Hand"])); };
  const SX = { Left: 1, Right: -1 };
  /** the feet kept where they stand while the hips move (the knees take it up) → call the returned function after
   *  moving the hips */
  function plant(fig) {
    const B = fig.bones; fig.root.updateMatrixWorld(true);
    const feet = ["Left", "Right"].map((S) => ({ S, p: at(fig, B[S + "Foot"]), q: modelQ(B[S + "Foot"], fig.root, new THREE.Quaternion()), knee: at(fig, B[S + "Leg"]).sub(at(fig, B[S + "UpLeg"])) }));
    return (move = null) => { for (const f of feet) {
      const tgt = move ? move(f.S, f.p.clone()) : f.p;
      reach(fig, B[f.S + "UpLeg"], B[f.S + "Leg"], B[f.S + "Foot"], tgt, V3(SX[f.S] * 0.55, 0, 1).addScaledVector(f.knee.setY(0), 2));
      setModelQ(fig, B[f.S + "Foot"], f.q);
    } };
  }
  /** fingers curled into a fist ("Left" | "Right" | "both"): a model's open hand does not punch. Each finger joint
   *  turns about the line of the knuckles, toward the palm (found once on the model as it stands at rest) */
  function fists(fig, which) {
    const C = fig.curl || (fig.curl = curlOf(fig));
    for (const S of which === "both" ? ["Left", "Right"] : [which]) for (const c of C[S] || []) c.bone.quaternion.copy(c.q);
  }
  /** the model as it stands at rest, in its own space (from the joints themselves: nothing is posed for this):
   *  every joint's orientation W and place P; per hand its fingers' line, its knuckles' line and the way its palm faces */
  function restOf(M) {
    if (M.restPose) return M.restPose;
    const W = [], P = [], idx = (n) => M.joints.findIndex((j) => j.name === n), hands = {};
    M.joints.forEach((j, i) => {
      const q = new THREE.Quaternion().fromArray(j.r), p = V3().fromArray(j.t);
      if (j.parent >= 0) { W[i] = W[j.parent].clone().multiply(q); P[i] = p.applyQuaternion(W[j.parent]).add(P[j.parent]); } else { W[i] = q; P[i] = p; }
    });
    for (const S of ["Left", "Right"]) {
      const i1 = idx(S + "HandIndex1"), p1 = idx(S + "HandPinky1"), m1 = idx(S + "HandMiddle1"), m3 = idx(S + "HandMiddle3"), h = idx(S + "Hand");
      if (i1 < 0 || p1 < 0 || m1 < 0 || m3 < 0 || h < 0) continue;
      const knuckles = P[p1].clone().sub(P[i1]).normalize(), finger = P[m3].clone().sub(P[m1]).normalize();
      // the palm faces down and in toward the body as the arm hangs or is held out
      const palm = V3(-SX[S] * 0.5, -1, 0).addScaledVector(finger, -V3(-SX[S] * 0.5, -1, 0).dot(finger)).normalize();
      hands[S] = { h, knuckles, finger, palm, len: P[m1].distanceTo(P[h]) };
    }
    return (M.restPose = { W, P, idx, hands });
  }
  /** one hand's fingers, each closed as far as asked ({ Index, Middle, Ring, Pinky, Thumb }: 0 open as the model
   *  stands … 1 as in a fist) — a pinch, a snap, a hand round a handful of dust (needs body.hands or body.fists) */
  function fingers(fig, S, amt) {
    const C = fig.curl || (fig.curl = curlOf(fig));
    for (const c of C[S] || []) c.bone.quaternion.copy(c.rest).slerp(c.q, Math.min(1.15, Math.max(0, amt[c.f] ?? 0)));
  }
  function curlOf(fig) {
    const out = {}, B = fig.bones, M = fig.M, { W, P: Pm, idx, hands } = restOf(M);
    for (const S of ["Left", "Right"]) {
      if (!hands[S]) continue;
      const { knuckles, finger, palm } = hands[S];
      const sign = Math.sign(V3().crossVectors(knuckles, finger).dot(palm)) || 1, list = [];
      for (const [F, angs] of [["Index", [1.25, 1.5, 1.0]], ["Middle", [1.3, 1.5, 1.0]], ["Ring", [1.35, 1.5, 1.0]], ["Pinky", [1.4, 1.5, 1.0]]]) angs.forEach((a, k) => {
        const j = idx(S + "Hand" + F + (k + 1)); if (j < 0 || !B[M.joints[j].name]) return;
        const ax = knuckles.clone().applyQuaternion(W[M.joints[j].parent].clone().invert());
        list.push({ bone: B[M.joints[j].name], f: F, rest: new THREE.Quaternion().fromArray(M.joints[j].r), q: new THREE.Quaternion().setFromAxisAngle(ax, sign * a).multiply(new THREE.Quaternion().fromArray(M.joints[j].r)) });
      });
      // the thumb folds over them
      const t1 = idx(S + "HandThumb1"), t3 = idx(S + "HandThumb3");
      if (t1 >= 0 && t3 >= 0) {
        const th = Pm[t3].clone().sub(Pm[t1]).normalize(), tax = V3().crossVectors(th, palm).normalize();
        [0.35, 0.5, 0.6].forEach((a, k) => {
          const j = idx(S + "HandThumb" + (k + 1)); if (j < 0) return;
          const ax = tax.clone().applyQuaternion(W[M.joints[j].parent].clone().invert());
          list.push({ bone: B[M.joints[j].name], f: "Thumb", rest: new THREE.Quaternion().fromArray(M.joints[j].r), q: new THREE.Quaternion().setFromAxisAngle(ax, a).multiply(new THREE.Quaternion().fromArray(M.joints[j].r)) });
        });
      }
      out[S] = list;
    }
    return out;
  }

  // ---- coded moves (EmberMoveSheet.CODED): a pose for each frame, over the stance or over a motion-captured clip.
  // The sheets re-time them like any clip (their phases name these frames)
  const lerp3 = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));
  const CODED = {
    // 马步冲拳 — 0 standing · 10 sunk into the horse stance, both fists drawn back to the waist · 13.5 the left fist out
    // · 18 the right fist driven straight out at shoulder height as the left comes back to the waist · 22 held out ·
    // 30 drawn back · 40 risen
    pc_horse_punch(fig, f) {
      const B = fig.bones, H = fig.hipH, s = ease(f / 10) * (1 - ease((f - 30) / 10)), p = ease((f - 14) / 4) * (1 - ease((f - 22) / 8));
      if (s <= 0 || !B.Hips) return;
      const feet = plant(fig);
      B.Hips.position.y -= 0.27 * H * s;
      feet((S, at0) => at0.lerp(V3(SX[S] * 0.43 * H, at0.y, 0.02 * H), s));
      // the back straight and square to the foe, the punching shoulder turned in behind the fist
      turn(fig, "Spine1", Y, (0.34 * p - 0.1 * (1 - p)) * s);
      fig.root.updateMatrixWorld(true);
      const hips = at(fig, B.Hips);
      for (const S of ["Left", "Right"]) {
        const sh = at(fig, B[S + "Arm"]), L = armLen(fig, S), sx = SX[S];
        const waist = V3(hips.x + sx * 0.27 * H, hips.y + 0.36 * H, hips.z - 0.03 * H);
        const out = V3(sx * 0.06 * H, sh.y - 0.03 * H, sh.z + 0.97 * L), pp = S === "Right" ? p : ease((f - 10.5) / 3) * (1 - ease((f - 14) / 3.5));     // (the left fist goes first — 14 — and comes back as the right goes out)
        if (S === "Left") waist.z -= 0.06 * H * p;                      // the other fist pulls back as the punch goes out
        reach(fig, B[S + "Arm"], B[S + "ForeArm"], B[S + "Hand"], lerp3(waist, out, pp), V3(sx * (0.25 + 0.3 * pp), -0.5 - 0.5 * pp, -1 + 0.8 * pp), Math.min(1, s * 2.5));
      }
    },
    // 以镜观敌 — the hand that holds the loupe raises it into her line of sight to the foe (0 → 11), holds it there
    // through the ray (to 25) and lowers it (to 36); the rest of her keeps its stance
    pc_loupe(fig, f) {
      const B = fig.bones, S = fig.side === "R" ? "Right" : "Left", held = fig.J.held, w = ease(f / 11) * (1 - ease((f - 25) / 10));
      if (w <= 0 || !held || !B.Head) return;
      fig.root.updateMatrixWorld(true);
      const eye = at(fig, B.Head).add(V3(0, 0.055, 0.07)), foe = fig.foeAt ? fig.root.worldToLocal(fig.foeAt.clone()) : V3(0, eye.y - 0.15, 2);
      const lens = eye.clone().addScaledVector(foe.sub(eye).normalize(), 0.6 * armLen(fig, S)), was = [B[S + "Arm"].quaternion.clone(), B[S + "ForeArm"].quaternion.clone()];
      const tgt = at(fig, B[S + "Hand"]).add(lens).sub(at(fig, held));
      for (let i = 0; i < 3; i++) { reach(fig, B[S + "Arm"], B[S + "ForeArm"], B[S + "Hand"], tgt, V3(SX[S] * 0.7, -1, 0)); fig.root.updateMatrixWorld(true); tgt.add(lens).sub(at(fig, held)); }
      B[S + "Arm"].quaternion.copy(was[0].slerp(B[S + "Arm"].quaternion, w)); B[S + "ForeArm"].quaternion.copy(was[1].slerp(B[S + "ForeArm"].quaternion, w));
      turn(fig, "Spine1", X, 0.08 * w);                  // she leans in to look
    },
    // 看表 — his triumph is not a cheer: the left hand brings the stopped watch up before his chest (0 → 16), he bows his
    // head to it and is still (to 48), and puts it away (to 60); the right hand hangs
    pc_watch(fig, f) {
      const B = fig.bones, H = fig.hipH, w = ease(f / 16) * (1 - ease((f - 48) / 12)), R0 = restOf(fig.M), Hd = R0.hands.Left;
      if (fig.carried?.group) fig.carried.group.visible = w > 0.15;
      if (w <= 0 || !B.Spine2 || !B.LeftArm || !Hd) return;
      turn(fig, "Spine1", X, 0.05 * w); turn(fig, "Spine1", Y, -0.1 * w);
      fig.root.updateMatrixWorld(true);
      const up = V3(0.1, 0.86, -0.5).normalize(), fwd = V3(-0.62, 0.25, 0.74).addScaledVector(up, -V3(-0.62, 0.25, 0.74).dot(up)).normalize();
      const from = new THREE.Matrix4().makeBasis(Hd.finger, Hd.palm.clone().negate(), V3().crossVectors(Hd.finger, Hd.palm.clone().negate())), to = new THREE.Matrix4().makeBasis(fwd, up, V3().crossVectors(fwd, up));
      const was = B.LeftHand.quaternion.clone();
      reach(fig, B.LeftArm, B.LeftForeArm, B.LeftHand, at(fig, B.Spine2).add(V3(0.1 * H, -0.06 * H, 0.27 * H)), V3(0.8, -1, -0.2), w);
      setModelQ(fig, B.LeftHand, new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert())).multiply(R0.W[Hd.h]));
      B.LeftHand.quaternion.copy(was.slerp(B.LeftHand.quaternion, w));
      fig.reached = "Left";
      fingers(fig, "Left", { Index: 0.3 * w, Middle: 0.35 * w, Ring: 0.4 * w, Pinky: 0.45 * w, Thumb: 0.3 * w });
      // the head bowed to it, turned a little its way; a breath let out as he looks
      turn(fig, "Neck", X, 0.16 * w); turn(fig, "Head", X, 0.3 * w); turn(fig, "Head", Y, 0.14 * w);
      B.Hips.position.y -= 0.012 * H * bell(f, 18, 44);
    },
    // 星陨 (STARFALL above). Posed in her own frame first, then the whole of her turned by the whirl
    pc_starfall(fig, f) {
      const B = fig.bones, H = fig.hipH, K = STARFALL, w = Math.min(1, Math.max(0, curve(K.w, f)));
      if (w <= 0 || !B.Hips || !B.RightArm) return;
      const S = fig.weapon.L && !fig.weapon.R ? "Left" : "Right", O = S === "Right" ? "Left" : "Right", sx = SX[S], hip = curve(K.hip, f);
      B.Hips.position.x += sx * hip[0] * H * w; B.Hips.position.y += hip[1] * H * w; B.Hips.position.z += hip[2] * H * w;
      const yaw = -sx * curve(K.yaw, f) * w, lean = curve(K.lean, f) * w, side = -sx * curve(K.side, f) * w;
      // (the bend is shared out along the whole back — hips, three spine joints, the neck — so she curves, never hinges)
      turn(fig, "Spine", Y, 0.22 * yaw); turn(fig, "Spine1", Y, 0.33 * yaw); turn(fig, "Spine2", Y, 0.45 * yaw);
      turn(fig, "Spine", X, 0.3 * lean); turn(fig, "Spine1", X, 0.35 * lean); turn(fig, "Spine2", X, 0.35 * lean);
      turn(fig, "Spine", Z, 0.5 * side); turn(fig, "Spine2", Z, 0.5 * side);
      const kn = curve(K.knee, f) * w;
      turn(fig, S + "UpLeg", X, -0.42 * kn); turn(fig, S + "Leg", X, 0.85 * kn); turn(fig, O + "UpLeg", X, 0.1 * kn); turn(fig, O + "Leg", X, 0.3 * kn);
      fig.root.updateMatrixWorld(true);
      for (const [T2, hk, ek, s2] of [[S, K.rod, K.rodElbow, sx], [O, K.free, K.freeElbow, -sx]]) {
        const L = armLen(fig, T2), sh = at(fig, B[T2 + "Arm"]), h = curve(hk, f), e = curve(ek, f);
        reach(fig, B[T2 + "Arm"], B[T2 + "ForeArm"], B[T2 + "Hand"], sh.add(V3(s2 * h[0] * L, h[1] * L, h[2] * L)), V3(s2 * e[0], e[1], e[2]), w);
      }
      fig.reached = S;
      const a = curve(K.aim, f); aimBlade(fig, V3(sx * a[0], a[1], a[2]), w);
      const hd = curve(K.head, f); turn(fig, "Neck", X, 0.4 * hd[0] * w); turn(fig, "Head", X, 0.6 * hd[0] * w); turn(fig, "Head", Z, -sx * hd[1] * w);
      turn(fig, "Hips", Y, -sx * Math.PI * 2 * (f < 22 ? curve(K.spin, f) : 0));          // (a full turn done is no turn)
      eyesFront(fig, Math.min(1, Math.max(0, curve(K.eyes, f))));
    },
    // 点火 (IGNITE above)
    pc_ignite(fig, f) {
      const B = fig.bones, H = fig.hipH, K = IGNITE, w = Math.min(1, Math.max(0, curve(K.w, f)));
      if (w <= 0 || !B.Hips || !B.RightArm) return;
      const feet = plant(fig), hip = curve(K.hip, f);
      B.Hips.position.x += hip[0] * H * w; B.Hips.position.y += hip[1] * H * w; B.Hips.position.z += hip[2] * H * w;
      // (he steps into the throw: the left foot goes forward under the sweep, and comes back as he settles)
      const st = ease((f - 10) / 5.5), bk0 = ease((f - 35) / 9), step = st * (1 - bk0);
      feet((S, p) => (S === "Left" ? p.add(V3(0, 0.04 * H * (Math.sin(Math.PI * st) + Math.sin(Math.PI * bk0)) * w, 0.14 * H * step * w)) : p));
      // the turn runs up the back (the hips a little, the chest most), the lean with it; the head stays on the foe
      const yaw = curve(K.yaw, f) * w, lean = curve(K.lean, f) * w, side = curve(K.side, f) * w;
      turn(fig, "Spine", Y, 0.25 * yaw); turn(fig, "Spine1", Y, 0.35 * yaw); turn(fig, "Spine2", Y, 0.4 * yaw);
      turn(fig, "Spine", X, 0.5 * lean); turn(fig, "Spine1", X, 0.5 * lean); turn(fig, "Spine1", Z, side);
      eyesFront(fig, Math.min(1, w * 1.5));
      turn(fig, "Head", X, -0.12 * bell(f, 20, 30) * w);                             // the chin up as he holds the pose
      fig.root.updateMatrixWorld(true);
      const L = armLen(fig, "Right"), sh = at(fig, B.RightArm), h = curve(K.hand, f), e = curve(K.elbow, f);
      // (the shoulder travels with the turn of the chest: the hand's place is taken from where the shoulder stands at
      // rest over the hips, so the arm is thrown by the body, not carried round with it)
      const base = at(fig, B.Hips).add(V3(-0.5 * (at(fig, B.LeftArm).distanceTo(sh)), sh.y - at(fig, B.Hips).y, 0)).lerp(sh, 0.55);
      reach(fig, B.RightArm, B.RightForeArm, B.RightHand, base.add(V3(-h[0] * L, h[1] * L, h[2] * L)), V3(-e[0], e[1], e[2]), w);
      fig.reached = "Right";
      fingers(fig, "Right", { Index: curve(K.index, f), Middle: curve(K.middle, f), Ring: curve(K.ring, f), Pinky: curve(K.ring, f), Thumb: curve(K.thumb, f) });
      const bk = Math.min(1, Math.max(0, curve(K.back, f)));
      if (bk > 0 && B.LeftArm) {
        fig.root.updateMatrixWorld(true);
        const hp = at(fig, B.Hips);
        reach(fig, B.LeftArm, B.LeftForeArm, B.LeftHand, V3(hp.x + 0.02 * H, hp.y + 0.1 * H, hp.z - 0.17 * H), V3(1, -0.2, -0.7), ease(bk));
        fingers(fig, "Left", { Index: 0.7 * bk, Middle: 0.75 * bk, Ring: 0.8 * bk, Pinky: 0.8 * bk, Thumb: 0.4 * bk });
      }
    },
  };

  // a coded move's own curves: values keyed on frames ([[frame, v | [x, y, z]] …]), a smooth curve through them
  // (Catmull-Rom: it flows through a key instead of stopping on it, and overshoots a little where the keys ask it to)
  function curve(keys, f) {
    const n = keys.length;
    if (f <= keys[0][0]) return keys[0][1];
    if (f >= keys[n - 1][0]) return keys[n - 1][1];
    let i = 1; while (keys[i][0] < f) i++;
    const t = (f - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]), p0 = keys[Math.max(0, i - 2)][1], p1 = keys[i - 1][1], p2 = keys[i][1], p3 = keys[Math.min(n - 1, i + 1)][1];
    const cr = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
    return Array.isArray(p1) ? p1.map((_, k) => cr(p0[k], p1[k], p2[k], p3[k])) : cr(p0, p1, p2, p3);
  }
  /** the eyes kept on the foe (+z) whatever the body under them does, by w */
  function eyesFront(fig, w) {
    const B = fig.bones; if (w <= 0 || !fig.headRest || !B.Head) return;
    fig.root.updateMatrixWorld(true);
    const f = V3(0, 0, 1).applyQuaternion(fig.headRest.clone().invert()).applyQuaternion(modelQ(B.Head, fig.root, new THREE.Quaternion()));
    const e = Math.max(-1.2, Math.min(1.2, yawOf(f))) * w;
    turn(fig, "Neck", Y, -0.4 * e); turn(fig, "Head", Y, -0.6 * e);
  }
  // 星陨 — the starfall queen's own move: a dancer's, the whole body in it (nothing of her is held still while one arm
  // works), frames:
  //   0 standing · 8 gathered: sunk a little and wound away from her foe, the scepter drawn low behind her, the free
  //   hand across her breast · 20 the whirl: she unwinds through a full turn as she rises, the scepter climbing round
  //   her in a spiral, the free arm opening out · 27 the pose, held aloft: the back arched, the scepter high and tipped
  //   back, the free arm long and low behind · 31 the command: the scepter brought down to point at her foe, the body
  //   following it over · 37 the arm carried on past · 60 come down and standing, with a last small sway
  // (x: toward her scepter side; hands are from their shoulders, × the arm)
  const STARFALL = {
    w: [[0, 0], [5, 0.8], [8, 1], [40, 1], [52, 0.4], [60, 0]],
    spin: [[0, 0], [8, -0.12], [11, 0.12], [15, 0.56], [18.5, 0.93], [20, 1.01], [22, 1]],        // × a full turn, toward her scepter side first
    yaw: [[0, 0], [8, -0.5], [14, -0.1], [20, 0.18], [27, 0.1], [31, 0.5], [34, 0.42], [40, 0.12], [50, -0.04], [60, 0]],
    lean: [[0, 0], [8, 0.13], [14, 0.0], [20, -0.2], [27, -0.24], [31, 0.22], [34, 0.2], [42, 0.03], [50, -0.03], [60, 0]],
    side: [[0, 0], [8, -0.1], [14, 0.14], [20, -0.1], [27, -0.07], [31, 0.08], [40, -0.04], [50, 0.02], [60, 0]],
    hip: [[0, [0, 0, 0]], [8, [-0.03, -0.055, -0.05]], [14, [0, 0.17, 0]], [20, [0, 0.33, -0.02]], [27, [0, 0.36, -0.03]], [31, [0, 0.3, 0.07]], [37, [0, 0.17, 0.05]], [46, [0, 0.0, 0.01]], [52, [0, -0.02, 0]], [60, [0, 0, 0]]],
    rod: [[0, [0.25, -0.8, 0.15]], [8, [0.42, -0.5, -0.3]], [14, [0.85, 0.05, 0.1]], [20, [0.34, 0.78, -0.06]], [27, [0.3, 0.84, -0.14]], [29.5, [0.3, 0.7, 0.4]], [31, [0.14, 0.2, 0.93]], [34, [0.22, 0.02, 0.9]], [40, [0.32, -0.35, 0.6]], [60, [0.25, -0.8, 0.15]]],
    rodElbow: [[0, [0.4, -0.6, -1]], [8, [0.8, 0, -0.8]], [14, [0.5, -1, -0.3]], [20, [1, -0.4, -0.3]], [27, [1, -0.4, -0.4]], [31, [0.7, -0.8, 0]], [40, [0.5, -0.8, -0.6]], [60, [0.4, -0.6, -1]]],
    aim: [[0, [0.05, 1, 0.1]], [8, [0.45, 0.55, -0.7]], [14, [0.9, 0.55, 0]], [20, [0.1, 1, -0.3]], [27, [0.05, 0.95, -0.42]], [31, [-0.02, 0.2, 1]], [34, [0, 0.1, 1]], [40, [0.05, 0.6, 0.8]], [50, [0.05, 1, 0.2]], [60, [0.05, 1, 0.1]]],
    free: [[0, [0.2, -0.85, 0.1]], [8, [-0.32, -0.2, 0.5]], [14, [0.72, -0.12, 0.18]], [20, [0.78, -0.36, -0.3]], [27, [0.72, -0.4, -0.42]], [31, [0.5, -0.5, -0.6]], [36, [0.55, -0.55, -0.4]], [46, [0.3, -0.8, 0]], [60, [0.2, -0.85, 0.1]]],
    freeElbow: [[0, [0.4, -0.6, -1]], [8, [0.9, -0.6, 0]], [14, [0.3, -1, -0.5]], [27, [0.3, -0.8, -0.8]], [60, [0.4, -0.6, -1]]],
    knee: [[0, 0], [8, 0.25], [14, 0.5], [20, 1], [27, 1], [31, 0.8], [40, 0.3], [48, 0], [60, 0]],     // her legs drawn up under her as she hangs in the air
    head: [[0, [0, 0]], [8, [0.12, -0.08]], [20, [-0.2, 0.1]], [27, [-0.24, 0.08]], [31, [0.1, -0.05]], [40, [0, 0]], [60, [0, 0]]],   // [nod (+ down), tilt]
    eyes: [[0, 0], [6, 1], [10, 1], [12.5, 0], [16, 0], [18.5, 1], [45, 1], [60, 0]],                 // her eyes on her foe (she spots it through the turn: the head leaves late and arrives early)
  };
  // 点火 — the igniter's own move, keyed the way a champion's is (anticipation · the throw · the pose held · a small,
  // sharp release · the follow-through), frames:
  //   0 standing · 9 the right hand dipped into the coat pocket at the hip, the right shoulder drawn back, the weight on
  //   the back foot, the left hand gone behind his back · 16 the handful sown: the arm swept low and wide up to his foe,
  //   the body turned through behind it, a step forward under it with the left foot · 23 the hand carried on up beside his head, thumb on
  //   the middle finger, the body upright again and still (held to 25) · 27 the snap: a flick of the wrist, nothing
  //   else moves · 34 the hand let fall open · 48 standing
  const IGNITE = {
    w: [[0, 0], [5, 0.75], [9, 1], [34, 1], [41, 0.45], [48, 0]],                 // how much of the move is on, over the stance
    yaw: [[0, 0], [9, -0.42], [13, 0.1], [16, 0.5], [18.5, 0.4], [23, 0.14], [25, 0.12], [27, 0.2], [34, 0.06], [48, 0]],     // the chest: + turns the right shoulder to the foe
    lean: [[0, 0], [9, 0.1], [16, 0.16], [19, 0.06], [23, -0.07], [25, -0.08], [27, 0.0], [30, -0.03], [48, 0]],             // + forward
    side: [[0, 0], [9, -0.07], [16, 0.03], [23, 0.0], [48, 0]],                    // + leans to his left
    hip: [[0, [0, 0, 0]], [9, [-0.035, -0.05, -0.07]], [16, [0.02, -0.045, 0.12]], [23, [0, -0.005, 0.06]], [25, [0, -0.003, 0.055]], [27, [0, -0.02, 0.07]], [31, [0, -0.005, 0.06]], [38, [0, -0.01, 0.03]], [48, [0, 0, 0]]],   // × hip height
    // the right hand, from the right shoulder (× the arm: x to his right, y up, z to the foe)
    hand: [[0, [0.2, -0.86, 0.12]], [9, [0.3, -0.78, -0.22]], [12.5, [0.68, -0.5, 0.36]], [16, [0.2, -0.04, 0.96]], [18, [0.1, 0.16, 0.86]], [23, [0.2, 0.44, 0.42]], [25, [0.21, 0.45, 0.41]], [27, [0.16, 0.36, 0.56]], [29, [0.17, 0.33, 0.52]], [34, [0.2, -0.3, 0.4]], [48, [0.2, -0.86, 0.12]]],
    elbow: [[0, [0.3, -0.5, -1]], [9, [0.7, -0.1, -1]], [16, [0.6, -0.9, -0.2]], [23, [0.95, -0.7, 0.05]], [27, [0.9, -0.8, 0.1]], [34, [0.5, -0.8, -0.6]], [48, [0.3, -0.5, -1]]],
    // its fingers (× a fist): closed on the dust, flung open, the pinch, the snap, let go
    index: [[0, 0.15], [9, 0.95], [13, 0.9], [16, -0.1], [20, 0.1], [23, 0.3], [25, 0.3], [27, 0.22], [34, 0.2], [48, 0.15]],
    middle: [[0, 0.15], [9, 1], [13, 0.95], [16, -0.1], [20, 0.25], [23, 0.62], [25, 0.64], [26, 0.7], [27, 1.1], [31, 0.9], [36, 0.25], [48, 0.15]],
    ring: [[0, 0.2], [9, 1], [13, 0.95], [16, -0.05], [20, 0.5], [23, 0.9], [27, 1], [31, 0.9], [36, 0.3], [48, 0.2]],
    thumb: [[0, 0.1], [9, 0.9], [13, 0.9], [16, -0.2], [20, 0.4], [23, 1], [25, 1.05], [27, 0.1], [34, 0.2], [48, 0.1]],
    // the left hand behind his back (how far it has gone there)
    back: [[0, 0], [4, 0], [10, 1], [36, 1], [46, 0], [48, 0]],
  };
  // ---- props: small things a figure carries that its model came without (a sheath at the hip, a book in the hand).
  // Plain shaded meshes on the figures' layer; gone with the figure as it burns away or before it has formed
  const PROP_VS = /* glsl */ `varying vec3 vN; void main() { vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const PROP_FS = /* glsl */ `
    uniform vec3 uC, uE, uHitC; uniform float uDisK; varying vec3 vN;
    void main() {
      if (uDisK > 0.4) discard;
      vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
      float wrap = clamp((dot(N, normalize(vec3(-0.45, 0.75, 0.6))) + 0.4) / 1.4, 0.0, 1.0), rim = pow(1.0 - clamp(N.z, 0.0, 1.0), 3.0);
      vec3 c = uC * (0.72 + 0.55 * wrap) + vec3(1.0, 0.76, 0.34) * rim * 0.22 + uE;
      c += uHitC * (0.45 + 0.55 * c);
      gl_FragColor = linearToOutputTexel(vec4(c, 1.0));
    }`;
  function propMesh(fig, geo, color, emit = null) {
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({ vertexShader: PROP_VS, fragmentShader: PROP_FS, side: THREE.DoubleSide,
      uniforms: { uC: { value: new THREE.Color(...color) }, uE: emit || { value: V3() }, uHitC: fig.hit, uDisK: fig.dis.k } }));
    m.material.customProgramCacheKey = () => "ember-model-prop";
    m.frustumCulled = false; m.layers.set(LAYER); fig.extras.push(m);
    return m;
  }
  /** what a figure carries (its suite's `carry`), built the first time it is posed and kept in its place every frame */
  function carry(fig, suite, clip, t, T) {
    const kind = suite.carry; if (!kind) return;
    if (fig.carried === undefined) fig.carried = kind === "sheath" ? makeSheath(fig, suite) : kind === "book" ? makeBook(fig) : kind === "watch" ? makeWatch(fig) : kind === "pick" || kind === "crowbar" ? makeTool(fig, kind) : null;
    if (kind === "watch" && fig.carried && clip !== "victory") fig.carried.group.visible = false;
    if (kind === "book" && fig.carried) holdBook(fig, suite, clip, t, T);
  }
  /** a sheath at the hip, where the blade comes to rest when it is put away (the last frame of the victory clip) */
  function makeSheath(fig, suite) {
    // (worn, not floating: hung at the left hip against the body — its mouth just above the hip joint on the body's
    // own surface there, measured on the model; its point down along the thigh and a little back. Where the victory
    // clip happens to leave the knife is not where a sheath hangs)
    const B = fig.bones, thigh = B.Hips, ends = fig.M.thing, R0 = restOf(fig.M), hi = R0.idx("Hips"), li = R0.idx("LeftUpLeg");
    if (!ends || !thigh || hi < 0 || li < 0) return null;
    const hip = R0.P[li], pos = fig.M.geo.attributes.position.array;
    let side = hip.x, front = 0;
    for (let k = 0; k < pos.length; k += 3) if (Math.abs(pos[k + 1] - hip.y) < 0.025 && pos[k] > 0 && Math.abs(pos[k + 2] - hip.z) < 0.05) side = Math.max(side, pos[k]);
    side = Math.min(side, hip.x * 2.2);                                       // (the cloak hangs wider than the hip: not out there)
    const len = ends[0].distanceTo(ends[1]) * 0.72, R = 0.02, dirF = V3(0.1, -0.9, -0.42).normalize();
    const inv = fig.inv[hi], qi = R0.W[hi].clone().invert();
    const mouth = V3(side + R * 0.6, hip.y + 0.045, hip.z + 0.03 + front).applyMatrix4(inv), dir = dirF.clone().applyQuaternion(qi);
    const g = new THREE.Group();
    g.position.copy(mouth); g.quaternion.setFromUnitVectors(Y, dir);
    const body = propMesh(fig, new THREE.CylinderGeometry(R * 0.5, R, len, 8, 1).translate(0, len / 2, 0), [0.1, 0.07, 0.06]);
    const throat = propMesh(fig, new THREE.CylinderGeometry(R * 1.12, R * 1.12, len * 0.1, 8, 1).translate(0, len * 0.05, 0), [0.62, 0.48, 0.24]);
    const chape = propMesh(fig, new THREE.CylinderGeometry(R * 0.2, R * 0.58, len * 0.14, 8, 1).translate(0, len * 0.95, 0), [0.62, 0.48, 0.24]);
    const strap = propMesh(fig, new THREE.CylinderGeometry(R * 1.25, R * 1.25, len * 0.06, 8, 1).translate(0, len * 0.4, 0), [0.2, 0.13, 0.09]);
    g.add(body, throat, chape, strap); g.scale.setScalar(1 / (thigh.getWorldScale(V3()).x / fig.root.getWorldScale(V3()).x || 1));
    thigh.add(g);
    return { group: g };
  }
  /** a pocket watch lying in the left palm: a brass case, a pale face, its lid stood open (shown only while a move
   *  has it out: pc_watch) */
  function makeWatch(fig) {
    const R0 = restOf(fig.M), Hd = R0.hands.Left, B = fig.bones; if (!Hd || !B.LeftHand) return null;
    const g = new THREE.Group(), r = 0.021, face = { value: V3(0.5, 0.36, 0.14) };
    g.add(propMesh(fig, new THREE.CylinderGeometry(r, r, 0.007, 20), [0.7, 0.52, 0.2]));
    g.add(propMesh(fig, new THREE.CylinderGeometry(r * 0.84, r * 0.84, 0.002, 20).translate(0, 0.0045, 0), [0.9, 0.86, 0.74], face));
    const lid = propMesh(fig, new THREE.CylinderGeometry(r, r, 0.0025, 20).translate(0, 0, r), [0.62, 0.45, 0.17]);
    lid.position.set(0, 0.004, -r); lid.rotation.x = -1.9; g.add(lid);
    g.add(propMesh(fig, new THREE.SphereGeometry(0.0045, 8, 6).translate(0, 0, -r - 0.004), [0.7, 0.52, 0.2]));     // the crown
    // (in the palm: past the wrist along the fingers, a little off the palm — in the hand bone's own space)
    const inv = fig.inv[Hd.h], out = Hd.palm.clone().negate();
    g.position.copy(R0.P[Hd.h]).addScaledVector(Hd.finger, Hd.len * 0.8).addScaledVector(out, 0.014).applyMatrix4(inv);
    const side = V3().crossVectors(Hd.finger, out).normalize(), wq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, out, V3().crossVectors(side, out)));
    g.quaternion.copy(R0.W[Hd.h].clone().invert().multiply(wq));
    g.scale.setScalar(1 / (B.LeftHand.getWorldScale(V3()).x / fig.root.getWorldScale(V3()).x || 1));
    g.visible = false; B.LeftHand.add(g);
    return { group: g };
  }
  /** a miner's tool in the right fist (its model came empty-handed): a pick — an ash haft, a double-pointed iron head —
   *  or a crowbar, hooked at its end. It stands out of the thumb side of the fist, along the knuckles; its far part is
   *  the figure's blade (the swoosh follows it). Wants body.fists "Right" */
  function makeTool(fig, kind) {
    const R0 = restOf(fig.M), Hd = R0.hands.Right, B = fig.bones; if (!Hd || !B.RightHand) return null;
    // (a haft does not stand square to the forearm: the wrist cocks it forward — about fifty degrees toward the fingers)
    const up0 = Hd.knuckles.clone().negate(), f0 = Hd.finger.clone().addScaledVector(up0, -Hd.finger.dot(up0)).normalize();
    const g = new THREE.Group(), up = up0.clone().multiplyScalar(Math.cos(0.87)).addScaledVector(f0, Math.sin(0.87)).normalize(), fwd = f0.clone().multiplyScalar(Math.cos(0.87)).addScaledVector(up0, -Math.sin(0.87)).normalize();
    const iron = [0.2, 0.2, 0.22], L = kind === "pick" ? 0.46 : 0.4;
    if (kind === "pick") {
      g.add(propMesh(fig, new THREE.CylinderGeometry(0.011, 0.013, L, 8).translate(0, L / 2 - 0.09, 0), [0.4, 0.27, 0.15]));
      for (const sg of [1, -1]) g.add(propMesh(fig, new THREE.CylinderGeometry(0.004, 0.016, 0.17, 6).rotateZ(-sg * Math.PI / 2).translate(sg * 0.085, L - 0.1, 0).rotateZ(0).translate(0, 0, 0), iron));
      g.add(propMesh(fig, new THREE.BoxGeometry(0.04, 0.04, 0.034).translate(0, L - 0.1, 0), iron));
    } else {
      g.add(propMesh(fig, new THREE.CylinderGeometry(0.008, 0.008, L, 6).translate(0, L / 2 - 0.07, 0), iron));
      g.add(propMesh(fig, new THREE.CylinderGeometry(0.004, 0.008, 0.07, 6).rotateZ(-1.0).translate(0.028, L - 0.055, 0), iron));
    }
    // (in the fist: at the root of the fingers, on the palm's side — in the hand bone's own space; x: the way the fingers point)
    const side = V3().crossVectors(up, fwd).normalize(), wq = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fwd, up, V3().crossVectors(fwd, up)));
    g.position.copy(R0.P[Hd.h]).addScaledVector(Hd.finger, Hd.len * 0.95).addScaledVector(Hd.palm, -0.022).applyMatrix4(fig.inv[Hd.h]);
    g.quaternion.copy(R0.W[Hd.h].clone().invert().multiply(wq));
    B.RightHand.add(g);
    if (!fig.blade) fig.blade = [0.3, 1].map((t) => { const o = new THREE.Object3D(); o.position.set(0, (L - 0.09) * t, 0); g.add(o); return o; });
    return { group: g };
  }
  /** an open book: two boards hinged on its spine (the group's +y), the pages up (+z) */
  function makeBook(fig) {
    const g = new THREE.Group(), glow = { value: V3() }, W = 0.078, Hh = 0.108;
    const halves = [1, -1].map((sx) => {
      const piv = new THREE.Group();
      piv.add(propMesh(fig, new THREE.BoxGeometry(W, Hh, 0.005).translate(sx * W / 2, 0, -0.0045), [0.2, 0.07, 0.06]));
      piv.add(propMesh(fig, new THREE.BoxGeometry(W * 0.93, Hh * 0.93, 0.009).translate(sx * W * 0.48, 0, 0.0025), [0.8, 0.74, 0.6], glow));
      g.add(piv); return { piv, sx };
    });
    g.add(propMesh(fig, new THREE.BoxGeometry(0.012, Hh, 0.012).translate(0, 0, -0.004), [0.16, 0.05, 0.05]));
    fig.root.add(g);
    fig.J.book = new THREE.Object3D(); fig.J.book.position.set(0, 0, 0.02); g.add(fig.J.book);
    return { group: g, halves, glow, open: 0.8 };
  }
  const BOOK_Q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(-1, 0, 0), V3(0, 0.62, 0.78).normalize(), V3(0, 0.78, -0.62).normalize()));
  /** the book held open before the chest in the left hand (whatever the clip does with that arm): read at rest — the
   *  head bowed to it — and raised to the foe as he casts, its pages alight */
  function holdBook(fig, suite, clip, t, T) {
    const B = fig.bones, bk = fig.carried; if (!B.Spine2 || !B.LeftHand) return;
    const a = clip === "attack" ? toFoe(fig, suite, t) : 0, shut = clip === "hurt" ? 1 - ease(t / 0.35) : 0;
    fig.root.updateMatrixWorld(true);
    // (the arm starts from its rest each frame, not from where the clip threw it: the same reach, the same turn of
    // the forearm, whatever the clip does — no wringing of the wrist as the other arm swings)
    for (const n of ["LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand"]) if (B[n]) B[n].quaternion.copy(fig.restQ[fig.bonesArr.indexOf(B[n])]);
    fig.root.updateMatrixWorld(true);
    const chest = at(fig, B.Spine2), pos = chest.clone().add(V3(0.075, -0.1 + 0.05 * a, 0.2 + 0.06 * a));
    // the hand lies open under it, palm to its boards, fingers along its spine: the wrist goes where that puts the palm
    const R0 = restOf(fig.M), H = R0.hands.Left;
    fig.reached = "Left";
    if (H) {
      const up = V3(0, 0.78, -0.62), fwd = V3(-0.3, 0.6, 0.74).addScaledVector(up, -V3(-0.3, 0.6, 0.74).dot(up)).normalize();
      const from = new THREE.Matrix4().makeBasis(H.finger, H.palm.clone().negate(), V3().crossVectors(H.finger, H.palm.clone().negate())), to = new THREE.Matrix4().makeBasis(fwd, up, V3().crossVectors(fwd, up));
      const turnQ = new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.invert()));
      reach(fig, B.LeftArm, B.LeftForeArm, B.LeftHand, pos.clone().addScaledVector(up, -0.016).addScaledVector(fwd, -H.len * 0.75), V3(0.7, -1, -0.3));
      setModelQ(fig, B.LeftHand, turnQ.multiply(R0.W[H.h]));
    }
    bk.group.position.copy(pos); bk.group.quaternion.copy(BOOK_Q);
    const open = Math.max(0.12, 0.82 + 0.1 * a - 0.6 * shut);
    for (const h of bk.halves) h.piv.rotation.y = -h.sx * ((Math.PI / 2 - 0.05) * (1 - open) + 0.1 * open);
    bk.glow.value.set(...(suite.spell?.tint || [0.9, 0.7, 0.35])).multiplyScalar(0.55 * a);
    if (clip === "idle") { turn(fig, "Neck", X, 0.14); turn(fig, "Head", X, 0.24); }
  }
  /** a reflection of a figure: the same skin on bones of its own, lit like a spirit in `tint`; sync(T) takes the
   *  figure's pose as it is now. The arena places it (mirrored: a negative x scale) and burns it away (dis.k) */
  function echo(fig, tint = [0.6, 0.8, 1.6]) {
    const M = fig.M, root = new THREE.Group();
    const bones = M.joints.map((j) => { const b = new THREE.Bone(); b.name = j.name; b.position.fromArray(j.t); b.quaternion.fromArray(j.r); b.scale.fromArray(j.s); return b; });
    M.joints.forEach((j, i) => (j.parent >= 0 ? bones[j.parent] : root).add(bones[i]));
    const look = NO_LOOK(), dis = disOf(M);
    look.ghost.value = 0.9; look.ghostC.value.set(...tint); dis.c.value.set(...tint); dis.k.value = 1;
    const mat = material(M, { value: V3() }, { value: 0 }, { k: { value: 0 }, c: { value: V3() }, at: { value: new THREE.Vector4(0, -9, 0, 0.09) } }, false, NO_LUX, dis, look);
    const mesh = new THREE.SkinnedMesh(M.geo, mat);
    mesh.frustumCulled = false; mesh.layers.set(LAYER); root.add(mesh); root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones, fig.inv), new THREE.Matrix4());
    return { root, dis, sync(T) { fig.bonesArr.forEach((b, i) => { bones[i].quaternion.copy(b.quaternion); bones[i].position.copy(b.position); }); look.t.value = T; }, dispose() { mat.dispose(); mesh.skeleton.dispose(); } };
  }

  /** the held fireball: it swells as the cast gathers, is gone from the release (it flies) and re-forms in the hand */
  function fireStep(fig, clip, t, T) {
    if (!fig.fire) return;
    let k = 1;
    if (clip === "attack") { const h = C.timing(fig).hit; k = t < h ? 1 + 0.5 * ease(t / h) : t < h + 0.45 ? 0 : ease((t - h - 0.45) / 0.35); }
    fig.fire.update(T, k);
  }
  /** clip ∈ idle | attack | hurt | victory | rest; t = seconds into the clip, T = global time → false once it ended */
  function pose(fig, clip, t, T) {
    const suite = suiteOf(fig);
    fig.nowT = T;
    if (suite && suite[clip]) {
      // remember the pose the figure leaves, to blend the new clip in from it
      const key = clip + ":" + suite[clip];
      if (fig.clipKey !== key || t < (fig.clipT ?? 0)) { fig.snap = fig.bonesArr.map((b) => b.quaternion.clone()); fig.snapHip = fig.bones.Hips?.position.y; fig.clipKey = key; fig.clipStart = T; }
      fig.clipT = t;
      if (fig.outline) fig.outline.visible = SHADE.value === 3;
      const RX = [clip === "idle" && !suite.stance ? null : suite.upright?.includes(clip) ? UPRIGHT : suite.lower?.includes(clip) ? LOWER : null, suite.keep?.[clip] ? ARMS[suite.keep[clip]] : null].filter(Boolean);
      const legs = RX.length ? lowerFromIdle(fig, suite, t, T, RX.length > 1 ? new RegExp(RX.map((r) => r.source).join("|")) : RX[0]) : null;
      for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
      const sig = suite.sig && fig.sig;
      const done = sig && clip === "attack" ? sigAttack(fig, suite, t, T) : sig && clip === "idle" ? sigIdle(fig, suite, t, T) : playClip(fig, clip, suite[clip], t, T);
      legs?.();
      if (clip === "attack" && (suite.face || suite.bow)) faceTarget(fig, suite, t);
      const w = ease((T - fig.clipStart) / (clip === "idle" ? BLEND_IDLE : BLEND));
      // (the target is taken before the bone is reset to the snapshot: slerp from where it was toward where the clip is)
      if (w < 1 && fig.snap) { fig.bonesArr.forEach((b, i) => { _w.copy(b.quaternion); b.quaternion.copy(fig.snap[i]).slerp(_w, w); }); if (fig.bones.Hips && fig.snapHip != null) fig.bones.Hips.position.y += (fig.snapHip - fig.bones.Hips.position.y) * (1 - w); }
      fig.suite = suite;
      if (suite.hover) hover(fig, clip, t, T);
      // a god stands a hand's breadth above the ground, rising and settling slowly (its idle stance kept)
      if (suite.float && fig.bones.Hips) fig.bones.Hips.position.y += fig.hipH * (suite.float + 0.012 * Math.sin(T * 1.3 + fig.phase));
      // one that rises as it casts (levitate: × its hip height at the full of the charge), and sinks back after
      if (suite.levitate && clip === "attack" && fig.bones.Hips) fig.bones.Hips.position.y += fig.hipH * suite.levitate * toFoe(fig, suite, t);
      // a sprite whirls once round as it gathers its spell
      if (suite.spin && clip === "attack") { const h = C.timing(fig).hit; turn(fig, "Hips", Y, Math.PI * 2 * ease(t / (h * 0.8))); }
      aimFor(fig, suite, clip, t);
      carry(fig, suite, clip, t, T);
      // the eyes on the foe: a plain attack's, and a signature's that casts or shoots (its head would otherwise keep
      // looking where its stance looks — off to the side); a signature that spins or leaps keeps its own head
      if (clip === "attack" && (!sig || ((suite.face || suite.bow) && !suite.spin))) lookAtFoe(fig, suite, t);
      if (suite.fists) fists(fig, suite.fists);
      wristCare(fig);
      spring(fig, T);
      if (T > fig.nextBlink + 0.14) fig.nextBlink = T + 2 + Math.random() * 3;
      fig.blink.value = T >= fig.nextBlink ? Math.sin(Math.min(1, (T - fig.nextBlink) / 0.14) * Math.PI) : 0;
      fireStep(fig, clip, t, T);
      fig.root.updateMatrixWorld(true);
      return done;
    }
    if (fig.outline) fig.outline.visible = SHADE.value === 3;
    for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
    if (clip === "rest") { fig.blink.value = 0; fig.glow.k.value = 0; fig.root.updateMatrixWorld(true); return true; }
    if (!/^(idle|attack|hurt|victory)$/.test(clip)) return false;
    const br = Math.sin(T * 2.4 + fig.phase), sway = Math.sin(T * 0.7 + fig.phase);
    const { done, hop, squeeze } = fig.style === "caster" ? caster(fig, clip, t, T) : fig.style === "archer" ? archer(fig, clip, t, T) : fig.style === "judgment" ? judgment(fig, clip, t, T) : fig.style === "bow" ? bow(fig, clip, t, T) : melee(fig, clip, t);
    // breathing and weight shift under every clip; at rest she glances down (at her blade) every few seconds
    turn(fig, "Spine1", X, 0.022 * br);
    turn(fig, "Spine", Y, 0.03 * sway);
    turn(fig, "Spine", Z, 0.025 * sway);
    turn(fig, "Head", X, -0.02 * br);
    turn(fig, "RightArm", X, -0.04 * br);
    turn(fig, "LeftArm", X, 0.03 * br);
    if (clip === "idle") { const g = bell((T + fig.phase * 2) % 9, 6, 8); turn(fig, "Head", Y, -0.32 * g); turn(fig, "Head", X, 0.16 * g); }
    if (fig.bones.Hips) { fig.bones.Hips.position.y += hop - 0.004 * (1 - br); fig.bones.Hips.position.x += 0.008 * sway; }
    spring(fig, T);
    // blinks: every 2–5 s, 0.14 s long; squeezed shut when hit
    if (T > fig.nextBlink + 0.14) fig.nextBlink = T + 2 + Math.random() * 3;
    const bl = T >= fig.nextBlink ? Math.sin(Math.min(1, (T - fig.nextBlink) / 0.14) * Math.PI) : 0;
    fig.blink.value = Math.max(bl, 0.85 * squeeze);
    fireStep(fig, clip, t, T);
    fig.root.updateMatrixWorld(true);
    return done;
  }

  // plug into the figure renderer and clips (after EmberSpriteFigures): model ids build here
  const base = { build: R.build, cached: R.cached, dispose: R.dispose, setHit: R.setHit, setEmit: R.setEmit, setFace: R.setFace, setPixelRatio: R.setPixelRatio, voxelsWorld: R.voxelsWorld, pose: C.pose };
  R.cached = (id) => (has(id) ? READY : base.cached(id));
  R.build = (id, o) => (has(id) ? build(id) : base.build(id, o));
  R.dispose = (fig) => { if (!fig.model) return base.dispose(fig); for (const m of fig.mats) m.dispose(); fig.mesh.skeleton.dispose(); fig.fire?.dispose(); for (const m of fig.extras || []) { m.geometry.dispose(); m.material.dispose(); } };
  R.setHit = (fig, r, g, b) => (fig.model ? fig.hit.value.set(r, g, b) : base.setHit(fig, r, g, b));
  // a beast's glow follows its clips' emission (a dragon drawing breath, a crystal charging)
  R.setEmit = (fig, k) => (fig.model ? (fig.look && (fig.look.emitK.value = fig.emitBase * k)) : base.setEmit(fig, k));
  R.setFace = (fig, e) => (fig.model ? undefined : base.setFace(fig, e));
  R.setPixelRatio = (fig, pr) => (fig.model ? undefined : base.setPixelRatio(fig, pr));
  R.voxelsWorld = (fig) => (fig.model ? pointsWorld(fig) : base.voxelsWorld(fig));
  const baseTiming = C.timing;
  C.timing = (fig) => (fig.model && !fig.beast && suiteOf(fig)?.attack && clipData(suiteOf(fig).attack) ? clipTiming(fig) : baseTiming(fig));
  C.pose = (fig, clip, t, T) => {
    if (!fig.model) return base.pose(fig, clip, t, T);
    if (!fig.beast) return pose(fig, clip, t, T);
    fig.outline.visible = SHADE.value === 3;
    fig.look.t.value = T;
    // the voxel figure's own clips, on the same bones; at rest a legend now and then rears and roars (its victory clip)
    const fl = fig.flourish, tf = fl && clip === "idle" ? (T + fig.phase * 2) % fl.every : Infinity;
    const r = tf < fl?.len ? (base.pose(fig, "victory", tf, T), true) : base.pose(fig, clip, t, T);
    fig.root.updateMatrixWorld(true);
    return r;
  };

  return Object.freeze({ has, ids: () => [...models.keys()], on, LAYER, onReady: (fn) => onReady.add(fn), setShade: (k) => { SHADE.value = k; }, setMocap: (on) => { MOCAP.on = !!on; }, setSig: (on) => { MOCAP.sig = !!on; }, setWrist: (on) => { WRIST.on = !!on; }, setSuite: (id, clip, name) => { (SUITES[id] ||= {})[clip] = name; }, reload: loadSheets, echo, suite: (id) => ({ ...SUITES[id] }), mocap: (id) => !!SUITES[id], shade: () => SHADE.value, eyes: (id) => { const e = models.get(id)?.eyes; return e ? [e.a, e.b] : null; } });
})();
