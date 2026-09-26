#!/usr/bin/env node
/* Assemble a realistic battlefield figure (docs/design/MINIATURES.md) from its Tripo parts, for tools/model_art.cjs.
 * Input (tools/models/real/, ignored by git with the other models):
 *   <id>.body.glb   the character made from its card art with Tripo's "T 姿势" image template (which leaves the hands
 *                   empty), retopologised and auto-rigged to the Mixamo skeleton, exported at 2K with its skeleton
 *   <sheet>.glb     a prop sheet: several held things modelled side by side from one image (split at the gaps)
 * Output: tools/models/figures/<id>.glb — one skinned mesh in its new rest pose, one texture atlas.
 *
 *   node tools/model_prep.cjs [id …]        (all figures in REAL when none is named)
 *
 * Per figure it
 *   · lowers the arms from the T-pose (the mesh is skinned into the new pose, which becomes the bind pose)
 *   · closes each holding hand round its grip (the fingers curled, the thumb over them) and bends the wrist
 *   · places each prop: "grip" through the fist along the knuckle line (the business end out of the thumb side, its
 *     broad face along the hand), "hang" from the fist straight down (a lantern), "shield" on the outside of the
 *     forearm, "orb" a glowing ball over the open palm (made here); each moves rigidly with its hand or forearm
 *   · packs the body texture and the prop sheets' into one atlas (body left half, sheets in the right half) */
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), SRC = path.join(ROOT, "tools", "models", "real"), OUT = path.join(ROOT, "tools", "models", "figures");

// per figure: its props (sheet file, piece index left → right, how it is held) and pose overrides
//   grip:  { hand, len (tip to tip, the figure ≈ 0.97 tall), at (grip point, 0 = the piece's bottom … 1 = top),
//            out ("top" | "bottom": the end that leaves the fist on the thumb side), turn (rad about the prop's axis),
//            axis / face (world directions: the top end / the broad face, instead of the knuckle line and the hand) }
//   hang:  { hand, len }                      shield: { arm, h, yaw, out, drop, fwd }
//   orb:   { hand, r, color }                 pose:   { arm, elbow, wrist, roll } (radians)
const REAL = {
  paladin: { props: [
    { sheet: "props-paladin", piece: 0, kind: "grip", hand: "R", len: 0.55, at: 0.87, out: "bottom" },
    { sheet: "props-paladin", piece: 1, kind: "shield", arm: "L", h: 0.4, yaw: 0.9 },
  ] },
  // batch 1 — props-b1: 0 spear, 1 kite shield, 2 longbow, 3 lantern
  guard: { props: [
    { sheet: "props-b1", piece: 0, kind: "grip", hand: "R", len: 1.0, at: 0.42, out: "top" },
    { sheet: "props-b1", piece: 1, kind: "shield", arm: "L", h: 0.46, yaw: 0.9 },
  ] },
  vesper: { props: [{ sheet: "props-b1", piece: 2, kind: "grip", hand: "L", len: 0.8, at: 0.5, axis: [0, 1, 0.12], face: [0, 0, 1] }] },
  wisp: { wings: true, props: [{ kind: "orb", hand: "L", r: 0.04, color: [150, 255, 180] }] },
  necromancer: { props: [{ sheet: "props-b1", piece: 3, kind: "hang", hand: "R", len: 0.2 }] },
  // batch 2 — props-b2 (long): 0 elven spear, 1 rusty spear, 2 scythe, 3 ice sword; props-b3 (short): 0 round sun shield, 1 arming sword, 2 dagger
  huntress: { props: [{ sheet: "props-b2", piece: 0, kind: "grip", hand: "R", len: 0.95, at: 0.42, axis: [0, 1, 0.1], face: [1, 0, 0] }] },
  skeleton: { props: [{ sheet: "props-b2", piece: 1, kind: "grip", hand: "R", len: 0.95, at: 0.42, axis: [0, 1, 0.1], face: [1, 0, 0] }] },
  reaper: { props: [{ sheet: "props-b2", piece: 2, kind: "grip", hand: "R", len: 1.0, at: 0.45, axis: [0, 1, 0.1], face: [0, 0, -1] }] },
  frostking: { props: [{ sheet: "props-b2", piece: 3, kind: "grip", hand: "R", len: 0.62, at: 0.88, out: "bottom" }] },
  squire: { props: [
    { sheet: "props-b3", piece: 1, kind: "grip", hand: "R", len: 0.45, at: 0.86, out: "bottom" },
    { sheet: "props-b3", piece: 0, kind: "shield", arm: "L", h: 0.34, yaw: 0.9 },
  ] },
  assassin: { props: [{ sheet: "props-b3", piece: 2, kind: "grip", hand: "R", len: 0.3, at: 0.85, out: "bottom" }] },
  // batch 3 — props-b4: 0 lantern, 1 astrolabe, 2 star scepter, 3 sun sword, 4 sun shield
  spark: { props: [{ kind: "orb", hand: "R", r: 0.036, color: [255, 170, 60] }] },
  leech: { props: [{ kind: "orb", hand: "L", r: 0.034, color: [200, 20, 40] }] },
  soulguide: { props: [{ sheet: "props-b4", piece: 0, kind: "hang", hand: "L", len: 0.2 }] },
  oracle: { props: [{ sheet: "props-b4", piece: 1, kind: "hang", hand: "L", len: 0.3 }] },
  nyx: { props: [{ sheet: "props-b4", piece: 2, kind: "grip", hand: "L", len: 0.6, at: 0.4, axis: [0, 1, 0.1], face: [0, 0, 1] }] },
  // batch 4 (new figures) — props-b5: 0 lava axe; the recruit reuses the squire's sword and shield (props-b3)
  cleric: { props: [{ kind: "orb", hand: "R", r: 0.038, color: [255, 228, 150] }] },
  berserker: { props: [{ sheet: "props-b5", piece: 0, kind: "grip", hand: "R", len: 0.72, at: 0.3, axis: [0, 1, 0.1], face: [0, 0, 1] }] },
  recruit: { props: [
    { sheet: "props-b3", piece: 1, kind: "grip", hand: "R", len: 0.45, at: 0.86, out: "bottom" },
    { sheet: "props-b3", piece: 0, kind: "shield", arm: "L", h: 0.34, yaw: 0.9 },
  ] },
  // batch 5 — fist fighters carry nothing; the moon knight reuses the kite shield (b1) and arming sword (b3)
  golem: { props: [] }, treant: { props: [] }, titan: { props: [] }, colossus: { props: [] },
  sentinel: { wings: true, props: [] },
  moonguard: { props: [
    { sheet: "props-b3", piece: 1, kind: "grip", hand: "R", len: 0.62, at: 0.86, out: "bottom" },
    { sheet: "props-b1", piece: 1, kind: "shield", arm: "L", h: 0.5, yaw: 0.9 },
  ] },
  selmyra: { props: [{ kind: "orb", hand: "R", r: 0.038, color: [150, 70, 220] }] },
  jingchen: { props: [{ kind: "orb", hand: "R", r: 0.05, color: [255, 150, 40] }] },
  aurion: { props: [{ sheet: "props-b4", piece: 3, kind: "grip", hand: "R", len: 0.62, at: 0.87, out: "bottom" }] },
  fenlos: { props: [{ sheet: "props-b2", piece: 0, kind: "grip", hand: "R", len: 0.95, at: 0.42, axis: [0, 1, 0.1], face: [1, 0, 0] }] },
  solaris: { props: [
    { sheet: "props-b4", piece: 3, kind: "grip", hand: "R", len: 0.55, at: 0.87, out: "bottom" },
    { sheet: "props-b4", piece: 4, kind: "shield", arm: "L", h: 0.42, yaw: 0.9 },
  ] },
};

function readGlb(file) {
  const b = fs.readFileSync(file), len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString()), bin = b.subarray(28 + len);
  const COMP = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }, SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const read = (i) => { const a = j.accessors[i], v = j.bufferViews[a.bufferView], T = COMP[a.componentType], out = new T(a.count * SIZE[a.type]);
    Buffer.from(bin.buffer, bin.byteOffset + (v.byteOffset || 0) + (a.byteOffset || 0), out.byteLength).copy(Buffer.from(out.buffer)); return out; };
  const image = (i) => { const v = j.bufferViews[j.images[i].bufferView]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  const baseColor = (prim) => image(j.textures[j.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source);
  return { j, read, image, baseColor };
}
// ---- 4×4 column-major
function mul(a, b) { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; }
const lib = fs.readFileSync(path.join(__dirname, "model_art.cjs"), "utf8");
const invert = eval("(" + lib.match(/function invert[\s\S]*?\n}/)[0] + ")"), decompose = eval("(" + lib.match(/function decompose[\s\S]*?\n}/)[0] + ")");
const trs = (t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) => { const [x, y, z, w] = q;
  return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
    2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; };
const axisAngle = (ax, a) => { const s = Math.sin(a / 2), n = Math.hypot(...ax); return trs([0, 0, 0], [(ax[0] / n) * s, (ax[1] / n) * s, (ax[2] / n) * s, Math.cos(a / 2)]); };
const T = (p) => trs(p), S = (k) => trs(undefined, undefined, [k, k, k]), app = (m, p) => [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
const aboutPoint = (R, p) => mul(T(p), mul(R, T(p.map((x) => -x))));
const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); }, cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const avg = (l) => [0, 1, 2].map((c) => l.reduce((a, p) => a + p[c], 0) / l.length);
const basis = (X, Y, Z) => [X[0], X[1], X[2], 0, Y[0], Y[1], Y[2], 0, Z[0], Z[1], Z[2], 0, 0, 0, 0, 1];   // source x, y, z → X, Y, Z

/** a prop sheet → its pieces left to right, each { idx (vertices), lo, hi } — pieces are the vertex groups whose x
 *  ranges do not overlap (the sheet lays them side by side) */
function pieces(G) {
  const gp = G.j.meshes[0].primitives[0], pos = G.read(gp.attributes.POSITION), idx = G.read(gp.indices), n = pos.length / 3;
  // connected pieces of the mesh (welded by position; uv seams split vertices)
  const key = new Map(), weld = new Int32Array(n), par = Int32Array.from({ length: n }, (_, i) => i);
  for (let i = 0; i < n; i++) { const k = [0, 1, 2].map((c) => Math.round(pos[i * 3 + c] * 1e4)).join(); if (!key.has(k)) key.set(k, i); weld[i] = key.get(k); }
  const find = (x) => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  for (let t = 0; t < idx.length; t += 3) { par[find(weld[idx[t]])] = find(weld[idx[t + 1]]); par[find(weld[idx[t + 1]])] = find(weld[idx[t + 2]]); }
  const comps = new Map(); for (let i = 0; i < n; i++) { const r = find(weld[i]); (comps.get(r) || comps.set(r, []).get(r)).push(i); }
  const box = (ids) => { const lo = [9, 9, 9], hi = [-9, -9, -9]; for (const i of ids) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], pos[i * 3 + c]); hi[c] = Math.max(hi[c], pos[i * 3 + c]); } return { lo, hi }; };
  // the sheet lays its things side by side: components whose x ranges overlap belong to one thing
  let groups = [...comps.values()].map((ids) => ({ idx: ids, ...box(ids) })).sort((a, b) => a.lo[0] - b.lo[0]);
  const out = [];
  for (const g of groups) { const last = out[out.length - 1]; if (last && g.lo[0] < last.hi[0]) { last.idx = last.idx.concat(g.idx); Object.assign(last, box(last.idx)); } else out.push({ ...g }); }
  return out.filter((g) => g.idx.length > n * 0.01);
}

function prep(id, cfg) {
  const B = readGlb(path.join(SRC, id + ".body.glb")), j = B.j, skin = j.skins[0], prim = j.meshes[0].primitives[0];
  const par = new Map(); j.nodes.forEach((nd, i) => (nd.children || []).forEach((c) => par.set(c, i)));
  const joints = skin.joints, names = joints.map((k) => j.nodes[k].name.replace(/^mixamorig:?/, "")), JI = (nm) => names.indexOf(nm);
  if (joints.some((k) => !j.nodes[k].translation && !j.nodes[k].rotation && !j.nodes[k].matrix)) throw new Error(`${id}: joints without transforms (export the rig at 2K: the 4K export drops them)`);
  const local = joints.map((k) => { const d = j.nodes[k]; return d.matrix || trs(d.translation, d.rotation, d.scale); });
  const parentJ = joints.map((k) => joints.indexOf(par.get(k)));
  const fk = (L) => { const W = []; const go = (k) => (W[k] ??= parentJ[k] < 0 ? L[k] : mul(go(parentJ[k]), L[k])); joints.forEach((_, k) => go(k)); return W; };
  const ibm0 = B.read(skin.inverseBindMatrices);
  const pos = B.read(prim.attributes.POSITION), uv = B.read(prim.attributes.TEXCOORD_0), J = B.read(prim.attributes.JOINTS_0), Wt = B.read(prim.attributes.WEIGHTS_0), idx = B.read(prim.indices);
  const n = pos.length / 3;
  { const k = JI("Head"), e = mul(fk(local)[k], [...ibm0.subarray(k * 16, k * 16 + 16)]); if (Math.abs(e[0] - 1) > 1e-3 || Math.abs(e[12]) > 1e-3) throw new Error(`${id}: the bind pose is not the rest pose`); }

  // ---- the auto-rig spreads arm and finger weights onto body parts far from the arm (ribs, cape, hair): posing the
  // arms would drag them into long slivers. Anything clear of the arm chain (shoulder → elbow → wrist → knuckles,
  // measured in the T-pose) and nearer the trunk than the arm loses its arm weights
  {
    const W0 = fk(local), at0 = (nm) => { const k = JI(nm); return [W0[k][12], W0[k][13], W0[k][14]]; };
    const segD = (p, a, b) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return Math.hypot(...sub(p, a.map((x, c) => x + ab[c] * t))); };
    const chains = ["Left", "Right"].map((s) => [at0(s + "Arm"), at0(s + "ForeArm"), at0(s + "Hand"), at0(s + "HandMiddle4")]);
    const trunk = [at0("Hips"), at0("Neck")];
    const armBone = names.map((nm) => /(Arm|Hand)/.test(nm) && !/Shoulder/.test(nm));
    let stripped = 0;
    for (let i = 0; i < n; i++) {
      let arm = 0; for (let s = 0; s < 4; s++) if (armBone[J[i * 4 + s]]) arm += Wt[i * 4 + s];
      if (arm < 1e-3) continue;
      const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      const d = Math.min(...chains.map((c) => Math.min(segD(p, c[0], c[1]), segD(p, c[1], c[2]), segD(p, c[2], c[3]))));
      // a wide sleeve hangs well below the arm but belongs to it; only what lies nearer the trunk than the arm is freed
      if (d < (cfg.armR ?? 0.06) || d < segD(p, trunk[0], trunk[1])) continue;
      const keep = 1 - arm; stripped++;
      if (keep < 1e-3) { J[i * 4] = JI("Spine2"); Wt[i * 4] = 1; for (let s = 1; s < 4; s++) Wt[i * 4 + s] = 0; continue; }
      for (let s = 0; s < 4; s++) Wt[i * 4 + s] = armBone[J[i * 4 + s]] ? 0 : Wt[i * 4 + s] / keep;
    }
    if (stripped) console.log(`${id}: ${stripped} vertices far from the arms lose their arm weights`);
  }
  // ---- the new rest pose (world-space turns in the T-pose frame: arms along ±x, palms down, facing +z)
  const L = local.slice(), P = cfg.pose || {};
  const turnWorld = (nm, R) => { const k = JI(nm); if (k < 0) return; const W = fk(L), p = [W[k][12], W[k][13], W[k][14]], Wn = mul(aboutPoint(R, p), W[k]); L[k] = parentJ[k] < 0 ? Wn : mul(invert(W[parentJ[k]]), Wn); };
  const props = cfg.props || [], holds = { R: props.find((p) => p.hand === "R"), L: props.find((p) => p.hand === "L") };
  for (const side of ["R", "L"]) {
    const h = holds[side]; if (!h) continue;
    const Hn = side === "R" ? "RightHand" : "LeftHand", m = side === "R" ? 1 : -1;       // mirrored: turns about z flip
    // a fist (fingers along ∓x, palm down → curl about ±z; the thumb over them about +x); an orb's hand only cups
    const curl = h.kind === "orb" ? [0.3, 0.35, 0.25] : [1.15, 1.35, 0.85];
    for (const f of ["Index", "Middle", "Ring", "Pinky"]) for (let s = 1; s <= 3; s++) turnWorld(Hn + f + s, axisAngle([0, 0, 1], m * curl[s - 1] * (f === "Index" ? 0.9 : 1)));
    if (h.kind !== "orb") { turnWorld(Hn + "Thumb1", axisAngle([1, 0, 0], 0.5)); turnWorld(Hn + "Thumb2", axisAngle([1, 0, 0], 0.7)); turnWorld(Hn + "Thumb3", axisAngle([1, 0, 0], 0.5)); }
  }
  const ARM = P.arm ?? 1.2, ELBOW = P.elbow ?? 0.25;
  turnWorld("RightArm", axisAngle([0, 0, 1], ARM)); turnWorld("LeftArm", axisAngle([0, 0, 1], -ARM));
  turnWorld("RightForeArm", axisAngle([1, 0, 0], -ELBOW)); turnWorld("LeftForeArm", axisAngle([1, 0, 0], -ELBOW));
  for (const side of ["R", "L"]) {
    const h = holds[side]; if (!h) continue;
    const Hn = side === "R" ? "RightHand" : "LeftHand", m = side === "R" ? 1 : -1;
    if (h.kind === "grip") { turnWorld(Hn, axisAngle([1, 0, 0], h.wrist ?? P.wrist ?? -0.75)); turnWorld(Hn, axisAngle([0, 0, 1], m * (h.roll ?? P.roll ?? -0.3))); }
    else if (h.kind === "orb") { turnWorld(Hn, axisAngle([0, 0, 1], m * 1.2)); turnWorld("Right" === Hn.slice(0, 5) ? "RightForeArm" : "LeftForeArm", axisAngle([1, 0, 0], -(h.raise ?? 1.1))); }   // palm turned up, forearm raised
  }
  const W1 = fk(L), skinM = joints.map((_, k) => mul(W1[k], [...ibm0.subarray(k * 16, k * 16 + 16)]));
  const pos1 = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], o = [0, 0, 0];
    for (let s = 0; s < 4; s++) { const w = Wt[i * 4 + s]; if (!w) continue; const q = app(skinM[J[i * 4 + s]], p); for (let c = 0; c < 3; c++) o[c] += w * q[c]; }
    pos1.set(o, i * 3); }
  const P1 = (nm) => { const k = JI(nm); return [W1[k][12], W1[k][13], W1[k][14]]; };

  // ---- props → vertices (in the new rest pose), each rigid on its bone
  const sheets = [...new Set(props.filter((p) => p.sheet).map((p) => p.sheet))], loaded = {};
  for (const s of sheets) { const G = readGlb(path.join(SRC, s + ".glb")); loaded[s] = { G, gp: G.j.meshes[0].primitives[0], parts: pieces(G) }; }
  const extra = [];               // { pos, uv, tri, bone, sheet | color }
  const fistOf = (side) => { const Hn = side === "R" ? "RightHand" : "LeftHand"; return avg(["Index", "Middle", "Ring", "Pinky"].flatMap((f) => [1, 2, 3, 4].map((s) => P1(Hn + f + s)))); };
  for (const pr of props) {
    const side = pr.hand || pr.arm, Hn = side === "R" ? "RightHand" : "LeftHand";
    let M, bone, verts, tris, uvs, sheet = pr.sheet, color = null;
    if (pr.kind === "orb") {
      // an icosphere (subdivided twice) over the palm
      const t = (1 + Math.sqrt(5)) / 2; let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(nrm);
      let F = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
      for (let r = 0; r < 2; r++) { const cache = new Map(), midp = (a, b) => { const k = a < b ? a + ":" + b : b + ":" + a; if (!cache.has(k)) { V.push(nrm(V[a].map((x, c) => (x + V[b][c]) / 2))); cache.set(k, V.length - 1); } return cache.get(k); };
        F = F.flatMap(([a, b, c]) => { const ab = midp(a, b), bc = midp(b, c), ca = midp(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; }); }
      const palm = avg([P1(Hn), P1(Hn + "Middle1"), P1(Hn + "Index1"), P1(Hn + "Pinky1")]), r = pr.r ?? 0.045;
      verts = V.map((v) => [palm[0] + v[0] * r, palm[1] + r * 1.1 + v[1] * r, palm[2] + v[2] * r]); tris = F.flat(); uvs = null; color = pr.color || [120, 255, 170];
      bone = JI(Hn); sheet = null;
    } else {
      const { G, gp, parts } = loaded[pr.sheet], pc = parts[pr.piece];
      if (!pc) throw new Error(`${id}: ${pr.sheet} has ${parts.length} pieces, no piece ${pr.piece}`);
      const gpos = G.read(gp.attributes.POSITION), guv = G.read(gp.attributes.TEXCOORD_0), gidx = G.read(gp.indices), mine = new Map(pc.idx.map((i, k) => [i, k]));
      const H = pc.hi[1] - pc.lo[1], cx = (pc.lo[0] + pc.hi[0]) / 2, cz = (pc.lo[2] + pc.hi[2]) / 2;
      if (pr.kind === "grip") {
        // the grip axis is the knuckle line (pinky → index, the thumb side); the broad face turns along the hand
        const D = nrm(sub(P1(Hn + "Index1"), P1(Hn + "Pinky1"))); let E = sub(P1(Hn + "Middle1"), P1(Hn)); E = nrm(E.map((x, c) => x - dot(E, D) * D[c]));
        let up = pr.out === "bottom" ? D.map((x) => -x) : D;
        if (pr.axis) { up = nrm(pr.axis); const f = pr.face || [0, 0, 1]; E = nrm(f.map((x, c) => x - dot(f, up) * up[c])); }   // an explicit world direction (a bow held upright, its curve forward)
        const Z = cross(E, up);
        const at = [cx, pc.lo[1] + (pr.at ?? 0.5) * H, cz], k = (pr.len ?? H) / H;
        M = mul(T(fistOf(side)), mul(basis(E, up, Z), mul(axisAngle([0, 1, 0], pr.turn ?? 0), mul(S(k), T(at.map((x) => -x))))));
        bone = JI(Hn);
      } else if (pr.kind === "hang") {
        const k = (pr.len ?? H) / H, f = fistOf(side);
        M = mul(T([f[0], f[1] - 0.012, f[2]]), mul(axisAngle([0, 1, 0], pr.turn ?? 0), mul(S(k), T([cx, pc.hi[1], cz].map((x) => -x)))));
        bone = JI(Hn);
      } else if (pr.kind === "shield") {
        const Fa = side === "R" ? "RightForeArm" : "LeftForeArm", el = P1(Fa), wr = P1(Hn), mid = el.map((x, c) => (x + wr[c]) / 2), s = side === "L" ? 1 : -1;
        const k = (pr.h ?? 0.4) / H, at = [mid[0] + s * (pr.out ?? 0.05), mid[1] - (pr.drop ?? 0.06), mid[2] + (pr.fwd ?? 0.02)];
        M = mul(T(at), mul(axisAngle([0, 1, 0], s * (pr.yaw ?? 0.9)), mul(S(k), T([cx, (pc.lo[1] + pc.hi[1]) / 2, pc.lo[2]].map((x) => -x)))));
        bone = JI(Fa);
      } else throw new Error(`${id}: unknown prop kind ${pr.kind}`);
      verts = pc.idx.map((i) => app(M, [gpos[i * 3], gpos[i * 3 + 1], gpos[i * 3 + 2]]));
      uvs = pc.idx.map((i) => [guv[i * 2], guv[i * 2 + 1]]);
      tris = []; for (let t = 0; t < gidx.length; t += 3) if (mine.has(gidx[t]) && mine.has(gidx[t + 1]) && mine.has(gidx[t + 2])) tris.push(mine.get(gidx[t]), mine.get(gidx[t + 1]), mine.get(gidx[t + 2]));
    }
    extra.push({ pos: verts, uv: uvs, tri: tris, bone, sheet, color, name: pr.kind + " " + (pr.sheet || "") + (pr.piece ?? "") });
  }

  // ---- atlas: body in the left half; sheets in 1024-px cells of the right half; solid colours in 32-px cells
  const cells = sheets.map((s, k) => ({ s, x: 2048 + (k % 2) * 1024, y: Math.floor(k / 2) * 1024 }));
  if (cells.length > 3) throw new Error(`${id}: at most 3 prop sheets`);
  const colors = [...new Set(extra.filter((e) => e.color).map((e) => e.color.join()))].map((c, k) => ({ c: c.split(",").map(Number), x: 4096 - 32 * (k + 1), y: 2048 - 32 }));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "model-prep-")), atlas = path.join(tmp, "atlas.jpg"), plan = [];
  fs.writeFileSync(path.join(tmp, "body.jpg"), B.baseColor(prim)); plan.push(["body.jpg", 0, 0, 2048]);
  for (const c of cells) { fs.writeFileSync(path.join(tmp, c.s + ".jpg"), loaded[c.s].G.baseColor(loaded[c.s].gp)); plan.push([c.s + ".jpg", c.x, c.y, 1024]); }
  execFileSync(fs.existsSync(path.join(ROOT, ".venv/bin/python")) ? path.join(ROOT, ".venv/bin/python") : "python3", ["-c", `from PIL import Image
o=Image.new('RGB',(4096,2048),(0,0,0))
for f,x,y,s in ${JSON.stringify(plan)}: o.paste(Image.open(${JSON.stringify(tmp)}+'/'+f).convert('RGB').resize((s,s)),(x,y))
for c in ${JSON.stringify(colors)}: o.paste(tuple(c['c']),(c['x'],c['y'],c['x']+32,c['y']+32))
o.save(${JSON.stringify(atlas)},quality=92)`]);
  const img = fs.readFileSync(atlas); fs.rmSync(tmp, { recursive: true });

  // ---- merge
  const N = n + extra.reduce((a, e) => a + e.pos.length, 0), outPos = new Float32Array(N * 3), outUV = new Float32Array(N * 2), outJ = new Uint8Array(N * 4), outW = new Float32Array(N * 4);
  const outOrb = new Uint8Array(N);                 // _ORB: 1 on an orb's vertices (the runtime may put real fire in its place)
  outPos.set(pos1); outJ.set(J); outW.set(Wt);
  for (let i = 0; i < n; i++) { outUV[i * 2] = uv[i * 2] * 0.5; outUV[i * 2 + 1] = uv[i * 2 + 1]; }
  // retopology slivers: a few needle triangles can span the whole T-pose (hand to hand) hidden inside the arms; posed,
  // they show as long lines — drop any triangle longer than 0.35 and thinner than 0.01
  const tris = []; let slivers = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const v = [idx[t], idx[t + 1], idx[t + 2]].map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]);
    const e = [sub(v[0], v[1]), sub(v[1], v[2]), sub(v[0], v[2])], L = Math.max(...e.map((x) => Math.hypot(...x))), h = Math.hypot(...cross(sub(v[1], v[0]), sub(v[2], v[0]))) / L;
    if (L > 0.35 && h < 0.01) { slivers++; continue; }
    tris.push(idx[t], idx[t + 1], idx[t + 2]);
  }
  if (slivers) console.log(`${id}: ${slivers} sliver triangles dropped`);
  let at = n;
  for (const e of extra) {
    const cell = e.sheet && cells.find((c) => c.s === e.sheet), col = e.color && colors.find((c) => c.c.join() === e.color.join());
    e.pos.forEach((p, k) => {
      outPos.set(p, (at + k) * 3); outJ[(at + k) * 4] = e.bone; outW[(at + k) * 4] = 1; if (e.name.startsWith("orb")) outOrb[at + k] = 1;
      if (cell) { outUV[(at + k) * 2] = (cell.x + e.uv[k][0] * 1024) / 4096; outUV[(at + k) * 2 + 1] = (cell.y + e.uv[k][1] * 1024) / 2048; }
      else { outUV[(at + k) * 2] = (col.x + 16) / 4096; outUV[(at + k) * 2 + 1] = (col.y + 16) / 2048; }
    });
    for (const t of e.tri) tris.push(t + at);
    at += e.pos.length;
  }
  const outIdx = Uint32Array.from(tris);

  // ---- write: Armature (identity) → joints (the new pose as their rest), the skinned mesh
  const nodes = [{ name: "Armature", children: [] }];
  joints.forEach((_, k) => { const d = decompose(L[k]); nodes.push({ name: "mixamorig:" + names[k], translation: d.t, rotation: d.r, scale: d.s, children: [] }); });
  joints.forEach((_, k) => (parentJ[k] < 0 ? nodes[0] : nodes[1 + parentJ[k]]).children.push(1 + k));
  nodes.push({ name: id, mesh: 0, skin: 0 });
  const ibm1 = new Float32Array(joints.length * 16); W1.forEach((w, k) => ibm1.set(invert(w), k * 16));
  const bufs = [], views = [], acc = [];
  let off = 0;
  const add = (arr, target) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); views.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(target ? { target } : {}) }); bufs.push(b); off += b.length; const pad = (4 - (b.length % 4)) % 4; if (pad) { bufs.push(Buffer.alloc(pad)); off += pad; } return views.length - 1; };
  const accessor = (arr, type, ct, count, extraA = {}) => { acc.push({ bufferView: add(arr, extraA.target), componentType: ct, count, type, ...(extraA.minmax || {}) }); return acc.length - 1; };
  const lo = [0, 1, 2].map((c) => { let m = 9; for (let i = 0; i < N; i++) m = Math.min(m, outPos[i * 3 + c]); return m; }), hi = [0, 1, 2].map((c) => { let m = -9; for (let i = 0; i < N; i++) m = Math.max(m, outPos[i * 3 + c]); return m; });
  const aP = accessor(outPos, "VEC3", 5126, N, { minmax: { min: lo, max: hi }, target: 34962 }), aU = accessor(outUV, "VEC2", 5126, N, { target: 34962 });
  const aJ = accessor(outJ, "VEC4", 5121, N, { target: 34962 }), aW = accessor(outW, "VEC4", 5126, N, { target: 34962 }), aI = accessor(outIdx, "SCALAR", 5125, outIdx.length, { target: 34963 });
  const aO = accessor(outOrb, "SCALAR", 5121, N, { target: 34962 });
  const aB = accessor(ibm1, "MAT4", 5126, joints.length), iv = add(img);
  const gl = { asset: { version: "2.0", generator: "tools/model_prep.cjs" }, scene: 0, scenes: [{ nodes: [0, nodes.length - 1] }], nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: aP, TEXCOORD_0: aU, JOINTS_0: aJ, WEIGHTS_0: aW, _ORB: aO }, indices: aI, material: 0 }] }],
    skins: [{ joints: joints.map((_, k) => 1 + k), inverseBindMatrices: aB, skeleton: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 }, doubleSided: true }],
    textures: [{ source: 0, sampler: 0 }], samplers: [{}], images: [{ bufferView: iv, mimeType: "image/jpeg" }],
    buffers: [{ byteLength: off }], bufferViews: views, accessors: acc };
  const bin = Buffer.concat(bufs);
  let js = Buffer.from(JSON.stringify(gl)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  const out = path.join(OUT, id + ".glb");
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(out, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]));
  console.log(`${id}: ${n} body + ${N - n} prop verts (${extra.map((e) => e.name.trim()).join(", ") || "no props"}) → ${path.relative(ROOT, out)}`);
}

const want = process.argv.slice(2), ids = want.length ? want : Object.keys(REAL);
for (const id of ids) {
  if (!REAL[id]) throw new Error(`no REAL entry for ${id}`);
  if (!fs.existsSync(path.join(SRC, id + ".body.glb"))) { console.log(`${id}: no ${id}.body.glb yet — skipped`); continue; }
  prep(id, REAL[id]);
}
