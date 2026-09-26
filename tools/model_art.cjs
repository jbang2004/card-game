#!/usr/bin/env node
/* Embed rigged battlefield models (docs/design/MINIATURES.md) into src/presentation/voxel/model-art.js for
 * EmberModelFigures. Input: tools/models/figures/<figure id>.glb — a Tripo model, retopologised and auto-rigged to the
 * Mixamo skeleton, exported with its skeleton and no animations (the source files are large and stay out of git).
 * A realistic figure's file is assembled by tools/model_prep.cjs (T-pose body + props) and set up here with line: []
 * (its props are already rigid on their bones), skirt (a long skirt follows the hips), style (its clip), lit (the
 * runtime lights it; mt = what each surface is) and tex (its texture size).
 *
 *   node tools/model_art.cjs
 *
 * Per model it
 *   · repairs the auto-rig's skin weights for a chibi (the auto-rig binds long hair to the arms or the head, wings to
 *     the head and held things to fingers, so any motion tears them): head, crown and hair above the neck move
 *     rigidly with the head; hair and cape hanging beside and behind follow the chest; what a hand holds moves
 *     rigidly with the hand, a shield with the forearm (FIGURES); wings hinge on their own joints; fingers are unused
 *   · adds a "Back" joint under the chest and hangs the mass behind the body on it (the long hair and the cape,
 *     more the lower it hangs): the runtime springs it, so hair and cape swing after a dash, a hit or a hop
 *   · hairGuard: hair (told by the crown's hue) lying against the weapon arm stays hair; forearmWeapon: a weapon the
 *     auto-rig bound to the forearm (far from the arm itself) goes to the hand
 *   · finds long held things (a blade, a spear, a scepter, a lantern's handle) as the longest gap-free thin line through
 *     the fist, and gives all of it to the hand (the auto-rig binds their far ends to legs, head or chest)
 *   · finds the blade (base at the guard, tip) in bind space, for the weapon trail
 *   · quantises the mesh (positions and uvs to 16 bits, joints and weights to 8) and shrinks the base-colour texture
 *     to 1024 px JPEG with its atlas islands padded over the black gutters (tools/model_texture.py, the art
 *     dependencies of requirements-art.txt); normals, metal/roughness and normal maps are dropped — the figures are
 *     unlit. Otherwise Node built-ins only. */
const fs = require("fs"), path = require("path"), os = require("os"), { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, ".."), SRC = path.join(ROOT, "tools", "models", "figures"), OUT = path.join(ROOT, "src", "presentation", "voxel", "model-art.js");
const TEX = 1024;
// per figure: what each hand holds ("held" = moves rigidly with the hand, "shield" = with the forearm), a blade in the
// right hand (for the weapon trail), wings (hinged on their own joints behind the back)
const FIGURES = {
  paladin: { right: "held", left: "shield", blade: true, line: [], skirt: 0.065, style: "judgment", lit: true, tex: 2048 },   // realistic (tools/model_prep.cjs)
  wisp: { left: "held", wings: true, wingX: 0.1, style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  frostking: { right: "held", blade: true, skirt: 0.065, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  assassin: { right: "held", blade: true, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  guard: { right: "held", left: "shield", blade: true, skirt: 0.065, style: "thrust", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  huntress: { right: "held", blade: true, style: "thrust", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  skeleton: { right: "held", blade: true, style: "thrust", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  spark: { right: "held", style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  leech: { left: "held", style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  nyx: { left: "held", skirt: 0.065, style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  squire: { right: "held", left: "shield", blade: true, skirt: 0.065, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  solaris: { right: "held", left: "shield", blade: true, skirt: 0.065, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  reaper: { right: "held", blade: true, skirt: 0.065, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  vesper: { left: "held", style: "bow", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  necromancer: { right: "held", skirt: 0.065, style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  soulguide: { left: "held", skirt: 0.065, style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  oracle: { left: "held", skirt: 0.065, style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  cleric: { right: "held", skirt: 0.065, style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  berserker: { right: "held", blade: true, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  recruit: { right: "held", left: "shield", blade: true, skirt: 0.065, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  golem: { style: "melee", bulky: true, line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  treant: { style: "melee", bulky: true, line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  titan: { style: "melee", bulky: true, line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  colossus: { style: "melee", bulky: true, line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  sentinel: { wings: true, wingX: 0.1, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  moonguard: { right: "held", left: "shield", blade: true, skirt: 0.065, style: "melee", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  selmyra: { right: "held", skirt: 0.065, style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  jingchen: { right: "held", skirt: 0.065, style: "caster", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  aurion: { right: "held", blade: true, skirt: 0.065, style: "judgment", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  fenlos: { right: "held", blade: true, style: "thrust", line: [], lit: true, tex: 2048, yaw: 0 },   // realistic
  // beasts on their voxel figures' skeletons (tools/beast_prep.cjs): the figures' own clips move them
  wolf: { beast: true, mt: 0, tex: 1536 }, moonfox: { beast: true, mt: 0, tex: 1536 }, duskstag: { beast: true, mt: 0, tex: 1536 },
  dragon: { beast: true, mt: 0, tex: 1536 }, spider: { beast: true, mt: 128, tex: 1536 },
};

function readGlb(file) {
  const b = fs.readFileSync(file), len = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + len).toString()), bin = b.subarray(28 + len);
  const COMP = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const read = (i) => {
    const a = j.accessors[i], v = j.bufferViews[a.bufferView], T = COMP[a.componentType], k = SIZE[a.type];
    const off = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || 0;
    if (stride && stride !== k * T.BYTES_PER_ELEMENT) throw new Error("interleaved accessors are not supported");
    const out = new T(a.count * k);
    Buffer.from(bin.buffer, bin.byteOffset + off, out.byteLength).copy(Buffer.from(out.buffer));
    return out;
  };
  const image = (i) => { const v = j.bufferViews[j.images[i].bufferView]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  return { j, read, image };
}
// 4×4 column-major helpers
function invert(m) {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  const d = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06);
  return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d, (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d, (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d, (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d, (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d];
}
const pt = (m) => [m[12], m[13], m[14]];
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}
/** column-major 4×4 without shear → { t, r (quaternion xyzw), s } */
function decompose(m) {
  const s = [0, 1, 2].map((c) => Math.hypot(m[c * 4], m[c * 4 + 1], m[c * 4 + 2]));
  const R = [0, 1, 2].map((c) => [0, 1, 2].map((r) => m[c * 4 + r] / s[c]));   // R[col][row]
  const m00 = R[0][0], m11 = R[1][1], m22 = R[2][2], tr = m00 + m11 + m22;
  let q;
  if (tr > 0) { const k = 0.5 / Math.sqrt(tr + 1); q = [(R[1][2] - R[2][1]) * k, (R[2][0] - R[0][2]) * k, (R[0][1] - R[1][0]) * k, 0.25 / k]; }
  else if (m00 > m11 && m00 > m22) { const k = 2 * Math.sqrt(1 + m00 - m11 - m22); q = [0.25 * k, (R[1][0] + R[0][1]) / k, (R[2][0] + R[0][2]) / k, (R[1][2] - R[2][1]) / k]; }
  else if (m11 > m22) { const k = 2 * Math.sqrt(1 + m11 - m00 - m22); q = [(R[1][0] + R[0][1]) / k, 0.25 * k, (R[2][1] + R[1][2]) / k, (R[2][0] - R[0][2]) / k]; }
  else { const k = 2 * Math.sqrt(1 + m22 - m00 - m11); q = [(R[2][0] + R[0][2]) / k, (R[2][1] + R[1][2]) / k, 0.25 * k, (R[0][1] - R[1][0]) / k]; }
  return { t: [m[12], m[13], m[14]], r: q, s };
}
const translation = (p) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, p[0], p[1], p[2], 1];
const sub = (a, b) => a.map((x, i) => x - b[i]), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function segDist(p, a, b) {
  const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab)));
  return Math.hypot(...sub(p, a.map((x, i) => x + ab[i] * t)));
}

function convert(id, file) {
  const { j, read, image } = readGlb(file);
  const skin = j.skins[0], prim = j.meshes[0].primitives[0];
  const jointNodes = skin.joints, names = jointNodes.map((n) => j.nodes[n].name.replace(/^mixamorig:?/, ""));
  const parentOf = new Map(); j.nodes.forEach((n, i) => (n.children || []).forEach((c) => parentOf.set(c, i)));
  const joints = jointNodes.map((n, i) => {
    const nd = j.nodes[n], p = jointNodes.indexOf(parentOf.get(n));
    return { name: names[i], parent: p, t: nd.translation || [0, 0, 0], r: nd.rotation || [0, 0, 0, 1], s: nd.scale || [1, 1, 1] };
  });
  // the root joint's ancestors (the armature) must be identity: the runtime hangs the skeleton straight off the figure
  for (let n = parentOf.get(jointNodes[joints.findIndex((q) => q.parent < 0)]); n != null; n = parentOf.get(n)) {
    const nd = j.nodes[n];
    if (nd.matrix || (nd.translation && nd.translation.some((x) => x)) || (nd.rotation && nd.rotation[3] !== 1) || (nd.scale && nd.scale.some((x) => x !== 1))) throw new Error(`${id}: the armature node ${nd.name} is not identity`);
  }
  const ibm = read(skin.inverseBindMatrices), world = names.map((_, i) => invert([...ibm.subarray(i * 16, i * 16 + 16)]));
  const at = (nm) => pt(world[names.indexOf(nm)]);
  const pos = read(prim.attributes.POSITION), uv = read(prim.attributes.TEXCOORD_0), idx = read(prim.indices);
  const J = read(prim.attributes.JOINTS_0), W = read(prim.attributes.WEIGHTS_0), n = pos.length / 3;
  const orb = prim.attributes._ORB != null ? read(prim.attributes._ORB) : null;     // tools/model_prep.cjs marks an orb
  if (!(W instanceof Float32Array)) throw new Error(`${id}: expected float weights`);

  const count = {}, cfg0 = FIGURES[id] || {};
  // ---- texture: the base colour, 1024 px
  const mat = j.materials[prim.material], src = j.textures[mat.pbrMetallicRoughness.baseColorTexture.index].source;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "model-art-")), raw = path.join(tmp, "raw" + (j.images[src].mimeType === "image/png" ? ".png" : ".jpg")), small = path.join(tmp, "tex.jpg");
  fs.writeFileSync(raw, image(src));
  const py = fs.existsSync(path.join(ROOT, ".venv", "bin", "python")) ? path.join(ROOT, ".venv", "bin", "python") : "python3";
  execFileSync(py, [path.join(__dirname, "model_texture.py"), raw, small, String(cfg0.tex || TEX)], { stdio: "ignore" });
  const tex = fs.readFileSync(small);
  let rgb = null, yawUsed = 0;
  if (cfg0.beast) return beastEntry(id, cfg0, { tex, joints, ibm, pos, uv, idx, J, W, n });
  // ---- facing: Tripo models a 3/4 sprite as it stands, turned. The runtime's clips assume the figure faces +z: find
  // where the face is (skin-coloured vertices on the head, seen from the head's centre) and turn the whole model —
  // mesh, joints, bind matrices — to face +z. FIGURES[id].yaw overrides
  {
    fs.writeFileSync(path.join(tmp, "vuv.f32"), Buffer.from(Float32Array.from(uv).buffer));
    execFileSync(py, [path.join(__dirname, "model_texture.py"), "--rgb", small, path.join(tmp, "vuv.f32"), path.join(tmp, "vrgb.u8")]);
    rgb = fs.readFileSync(path.join(tmp, "vrgb.u8")); const hd = at("Head"), headI = names.indexOf("Head");
    let sx = 0, sz = 0, m = 0;
    for (let i = 0; i < n; i++) {
      let w = 0; for (let k = 0; k < 4; k++) if (J[i * 4 + k] === headI) w += W[i * 4 + k];
      const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
      if (w < 0.5 || !(r > 200 && g > 140 && b > 100 && r > g + 12 && g > b + 6)) continue;
      sx += pos[i * 3] - hd[0]; sz += pos[i * 3 + 2] - hd[2]; m++;
    }
    // no face to see (a helm, a skull): the feet say where the auto-rig thinks forward is — toes ahead of the ankles
    let fx = 0, fz = 0;
    for (const s2 of ["Left", "Right"]) { const f = at(s2 + "Foot"), t2 = at(s2 + "ToeBase"); fx += t2[0] - f[0]; fz += t2[2] - f[2]; }
    const byFace = m > 40 && Math.hypot(sx, sz) / m > 0.02;
    const yaw = FIGURES[id]?.yaw ?? (byFace ? Math.atan2(sx, sz) : Math.hypot(fx, fz) > 0.02 ? Math.atan2(fx, fz) : 0);
    yawUsed = Math.abs(yaw) > 0.12 ? yaw : 0;
    count.facing = byFace ? "face" : "feet";
    if (Math.abs(yaw) > 0.12) {
      const c = Math.cos(-yaw), s_ = Math.sin(-yaw), Ry = [c, 0, -s_, 0, 0, 1, 0, 0, s_, 0, c, 0, 0, 0, 0, 1];
      for (let i = 0; i < n; i++) { const x = pos[i * 3], z = pos[i * 3 + 2]; pos[i * 3] = c * x + s_ * z; pos[i * 3 + 2] = -s_ * x + c * z; }
      for (let i = 0; i < world.length; i++) { world[i] = mul(Ry, world[i]); ibm.set(invert(world[i]), i * 16); }
      const ri = joints.findIndex((q) => q.parent < 0), d = decompose(world[ri]);
      Object.assign(joints[ri], { t: d.t, r: d.r, s: d.s });
      count.turned = +((yaw * 180) / Math.PI).toFixed(0);
    }
  }
  const centre = (list) => (list.length ? [0, 1, 2].map((c) => list.reduce((a, p) => a + p[c], 0) / list.length) : null);
  // ---- skin repair (see the header); what each hand holds and whether it has wings is the figure's (FIGURES)
  const cfg = FIGURES[id] || {};
  const headY0 = at("Head")[1];
  // the hair colour: the commonest colour on the crown of the head (hair lying against an arm is told by it)
  const hc = new Map(), headJ = names.indexOf("Head");
  for (let i = 0; i < n; i++) {
    if (pos[i * 3 + 1] < headY0 + 0.08) continue;
    let w = 0; for (let k = 0; k < 4; k++) if (J[i * 4 + k] === headJ) w += W[i * 4 + k];
    if (w < 0.5) continue;
    const q = [0, 1, 2].map((c) => rgb[i * 3 + c] >> 5).join(); hc.set(q, (hc.get(q) || 0) + 1);
  }
  const top = [...hc].sort((a, b) => b[1] - a[1])[0], hair = top ? top[0].split(",").map((x) => (+x << 5) + 16) : null;
  // by hue and saturation (hair is painted in several shades of one colour); a grey or near-black hair colour has no
  // reliable hue, so there it falls back to the colour distance
  const hsv = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, mx ? d / mx : 0, mx / 255]; };
  const hh = hair && hsv(...hair);
  const isHair = (i) => {
    if (!hair) return false;
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    if (hh[1] < 0.25 || hh[2] < 0.2) return Math.abs(r - hair[0]) + Math.abs(g - hair[1]) + Math.abs(b - hair[2]) < 70;
    const [h, s2, v] = hsv(r, g, b), dh = Math.min(Math.abs(h - hh[0]), 1 - Math.abs(h - hh[0]));
    return dh < 0.06 && Math.abs(s2 - hh[1]) < 0.35 && v > 0.25;
  };
  // hairGuard: hair, plus any colours listed (a cape lining lying on the sword arm) stay off the weapon
  const guardCols = cfg.guardColors || [];
  const guarded = (i) => isHair(i) || guardCols.some((c) => Math.abs(rgb[i * 3] - c[0]) + Math.abs(rgb[i * 3 + 1] - c[1]) + Math.abs(rgb[i * 3 + 2] - c[2]) < 90);

  const I = (nm) => names.indexOf(nm);
  const arm = { R: [at("RightArm"), at("RightForeArm"), at("RightHand")], L: [at("LeftArm"), at("LeftForeArm"), at("LeftHand")] };
  const neckY = at("Neck")[1], headY = at("Head")[1], head = at("Head"), R_ARM = 0.075;
  const set = (i, list) => { for (let k = 0; k < 4; k++) { J[i * 4 + k] = list[k] ? I(list[k][0]) : 0; W[i * 4 + k] = list[k] ? list[k][1] : 0; } };
  const held = { R: [], L: [] }, tags = new Array(n), wing = [], dom0 = new Array(n);
  const hangingHair = (i, p) => {                // hair beside and below the head: chest, a little head near the top
    if (p[1] > neckY - 0.06) set(i, [["Head", 1]]);
    else { const t = Math.max(0, Math.min(1, (p[1] - (neckY - 0.3)) / 0.24)); set(i, [["Spine2", 1 - t * 0.5], ["Head", t * 0.5]]); }
  };
  for (let i = 0; i < n; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
    let dom = "", bw = -1;
    for (let k = 0; k < 4; k++) if (W[i * 4 + k] > bw) { bw = W[i * 4 + k]; dom = names[J[i * 4 + k]]; }
    dom0[i] = dom;
    const side = /^Right/.test(dom) ? "R" : /^Left/.test(dom) ? "L" : "";
    let tag = "body";
    if (cfg.wings && /^(Head|Neck|Spine2|LeftShoulder|RightShoulder)$/.test(dom) && ((p[2] < head[2] - 0.03 && Math.abs(p[0] - head[0]) > (cfg.wingX ?? 0.15)) || Math.abs(p[0] - head[0]) > 0.26)) { tag = p[0] < head[0] ? "wingR" : "wingL"; wing.push(i); }
    else if (!cfg.bulky && dom === "Head" && p[1] < neckY - 0.02 && (p[2] < head[2] - 0.02 || Math.abs(p[0] - head[0]) > 0.1)) { hangingHair(i, p); tag = "hair"; }
    else if (dom === "Head" || (dom === "Neck" && p[1] > headY - 0.02)) { set(i, [["Head", 1]]); tag = "head"; }
    else if (/Arm|Hand|Shoulder/.test(dom)) {
      const d = Math.min(segDist(p, arm[side][0], arm[side][1]), segDist(p, arm[side][1], arm[side][2])), hold = cfg[side === "R" ? "right" : "left"];
      const wrist = Math.hypot(...sub(p, arm[side][2]));
      if (hold === "held" && !(cfg.hairGuard && guarded(i) && wrist > 0.08) && (/Hand/.test(dom) || (cfg.forearmWeapon && /ForeArm/.test(dom) && d > R_ARM))) { set(i, [[side === "R" ? "RightHand" : "LeftHand", 1]]); tag = "held"; held[side].push(p); }
      else if (hold === "shield" && /ForeArm|Hand/.test(dom) && d > R_ARM * 0.8) { set(i, [[side === "R" ? "RightForeArm" : "LeftForeArm", 1]]); tag = "shield"; }
      // the hand and its fingers reach well past the wrist: they stay the hand's, never hanging hair
      else if (/Hand/.test(dom)) { set(i, [[side === "R" ? "RightHand" : "LeftHand", 1]]); tag = "hand"; }
      else if (d > R_ARM && !cfg.bulky) { hangingHair(i, p); tag = "hair"; }      // a bulky arm is that thick itself
    }
    count[tag] = (count[tag] || 0) + 1; tags[i] = tag;
  }
  // a long skirt (tabard, robe) the auto-rig split between the two thighs tears apart on a step: what hangs well clear
  // of both legs follows the hips, and only a little of each thigh
  if (cfg.skirt) {
    const legs = ["Left", "Right"].map((s) => [at(s + "UpLeg"), at(s + "Leg"), at(s + "Foot")]), R_LEG = cfg.skirt;
    for (let i = 0; i < n; i++) {
      if (tags[i] !== "body" || !/UpLeg|^(Left|Right)Leg$|Hips/.test(dom0[i])) continue;
      const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      if (p[1] > at("Hips")[1] + 0.02) continue;
      const d = legs.map(([a, b, c]) => Math.min(segDist(p, a, b), segDist(p, b, c)));
      const clear = Math.min(...d);
      if (clear < R_LEG) continue;
      const k = Math.min(1, (clear - R_LEG) / 0.04), near = d[0] < d[1] ? "LeftUpLeg" : "RightUpLeg", far = near === "LeftUpLeg" ? "RightUpLeg" : "LeftUpLeg";
      // blend the auto-rig's weights toward the skirt weights by how clear of the legs it hangs
      const want = new Map([[I("Hips"), 0.6], [I(near), 0.28], [I(far), 0.12]]), mix = new Map();
      for (let s = 0; s < 4; s++) if (W[i * 4 + s]) mix.set(J[i * 4 + s], (mix.get(J[i * 4 + s]) || 0) + W[i * 4 + s] * (1 - k));
      for (const [jj, w] of want) mix.set(jj, (mix.get(jj) || 0) + w * k);
      const top = [...mix].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, x) => a + x[1], 0);
      for (let s = 0; s < 4; s++) { J[i * 4 + s] = top[s] ? top[s][0] : 0; W[i * 4 + s] = top[s] ? top[s][1] / sum : 0; }
      count.skirt = (count.skirt || 0) + 1; tags[i] = "skirt";
    }
  }
  // a long weapon (spear, sword) runs well past the hand, and the auto-rig binds its far parts to whatever is near
  // (legs, head, chest): grow a thin cylinder along the held points' axis and give everything on it to the hand
  for (const S of cfg.line || (cfg.blade ? ["R"] : [])) {
    const HAND = S === "R" ? "RightHand" : "LeftHand";
    // the weapon line: through the fist, the direction (within 60° of vertical, as held at rest) along which a thin
    // cylinder stays filled the longest without a gap; everything on it moves with the hand
    const R = 0.025, STEP = 0.02, c0 = at(HAND), P = [];     // the auto-rig may bind the whole weapon to the forearm: start at the wrist
    for (let i = 0; i < n; i++) {
      // hair, hood and cape the auto-rig bound to the head or the torso are never the weapon, however close they hang
      if (/^(Head|Neck|Spine)/.test(dom0[i]) || tags[i] === "head") continue;
      if (cfg.hairGuard && guarded(i) && Math.hypot(pos[i * 3] - c0[0], pos[i * 3 + 1] - c0[1], pos[i * 3 + 2] - c0[2]) > 0.08) continue;   // hair beside the blade (a gold hilt by the fist stays)
      if (Math.hypot(pos[i * 3] - c0[0], pos[i * 3 + 2] - c0[2]) < 0.35) P.push(i);    // a column round the fist
    }
    let c = c0;
    const run = (d) => {
      const slabs = new Map(), hits = [];
      for (const i of P) {
        const q = [pos[i * 3] - c[0], pos[i * 3 + 1] - c[1], pos[i * 3 + 2] - c[2]], t = dot(q, d);
        if (Math.hypot(q[0] - d[0] * t, q[1] - d[1] * t, q[2] - d[2] * t) >= R) continue;
        const k = Math.round(t / STEP); slabs.set(k, (slabs.get(k) || 0) + 1); hits.push([i, k]);
      }
      // retopologised shafts have long quads (few vertices along them): bridge gaps of up to GAP slabs
      const GAP = cfg.gap ?? 7, next = (k, s) => { for (let g = 1; g <= GAP; g++) if (slabs.has(k + s * g)) return k + s * g; return null; };
      let lo = 0, hi = 0, k;
      while ((k = next(hi, 1)) != null) hi = k;
      while ((k = next(lo, -1)) != null) lo = k;
      return { len: hi - lo, lo, hi, on: hits.filter(([, k]) => k >= lo && k <= hi).map(([i]) => i) };
    };
    // the line need not pass through the fist's centre (a fist is wider than a shaft): search its offset too
    let best = { len: -1 };
    for (let ox = -0.09; ox <= 0.0901; ox += 0.015) for (let oz = -0.09; oz <= 0.0901; oz += 0.015) {
      c = [c0[0] + ox, c0[1], c0[2] + oz];
      for (let a = 0; a <= 0.53; a += 0.07) for (let b = 0; b < Math.PI * 2; b += a ? 0.25 : 7) {
        const d = [Math.sin(a) * Math.cos(b), Math.cos(a), Math.sin(a) * Math.sin(b)], r = run(d);
        if (r.len > best.len) best = { ...r, d, c };
      }
    }
    // then extend it past its ends over what the auto-rig bound to the head or torso (a spear tip beside the skull),
    // on a tighter radius so hair beside it stays hair
    if (best.d && cfg.extend) {
      const R2 = 0.016, slabs = new Map(), hits = [];
      for (let i = 0; i < n; i++) {
        if (Math.hypot(pos[i * 3] - c0[0], pos[i * 3 + 2] - c0[2]) >= 0.35) continue;
        const q = [pos[i * 3] - best.c[0], pos[i * 3 + 1] - best.c[1], pos[i * 3 + 2] - best.c[2]], t = dot(q, best.d);
        if (Math.hypot(q[0] - best.d[0] * t, q[1] - best.d[1] * t, q[2] - best.d[2] * t) >= R2) continue;
        const k = Math.round(t / STEP); slabs.set(k, true); hits.push([i, k]);
      }
      let lo = best.lo, hi = best.hi;
      const step = (k, s2) => { for (let g = 1; g <= 4; g++) if (slabs.has(k + s2 * g)) return k + s2 * g; return null; };
      let k2; while ((k2 = step(hi, 1)) != null) hi = k2; while ((k2 = step(lo, -1)) != null) lo = k2;
      const extra = hits.filter(([i, k]) => (k > best.hi || k < best.lo) && k >= lo && k <= hi).map(([i]) => i);
      best.on = best.on.concat(extra); count["ext" + S] = extra.length;
    }
    for (const i of best.on) if (tags[i] !== "held") { set(i, [[HAND, 1]]); count.held = (count.held || 0) + 1; count[tags[i]]--; tags[i] = "held"; }
    held[S] = held[S].concat(best.on.map((i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]]));
    count["line" + S] = Math.round(best.len * STEP * 100) / 100;
  }
  // anything that is not the arm itself (hair, hood, cape, torso) loses the arm weights the auto-rig spread onto it:
  // one raised arm would otherwise drag long sheets of it along. A bulky figure (stone, bark: no hair, no cape) keeps
  // them — its forearms and fists are far thicker than the arm radius and would be torn off onto the chest
  if (!cfg.bulky) {
    const ARM = /Arm|Hand|Shoulder/, armBone = names.map((nm) => ARM.test(nm));
    const segs = ["R", "L"].map((s) => [...arm[s].slice(0, 2).map((p, i) => [p, arm[s][i + 1]])]).flat();
    let cleaned = 0;
    for (let i = 0; i < n; i++) {
      if (tags[i] !== "body" && tags[i] !== "hair") continue;
      const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
      if (Math.min(...segs.map(([a, b]) => segDist(p, a, b))) < R_ARM * 0.9 && !(cfg.hairGuard && guarded(i))) continue;
      let keep = 0, drop = 0;
      for (let k = 0; k < 4; k++) (armBone[J[i * 4 + k]] ? (drop += W[i * 4 + k]) : (keep += W[i * 4 + k]));
      if (drop < 0.01) continue;
      cleaned++;
      if (keep < 0.01) { set(i, [["Spine2", 1]]); continue; }
      for (let k = 0; k < 4; k++) W[i * 4 + k] = armBone[J[i * 4 + k]] ? 0 : W[i * 4 + k] / keep;
    }
    count.armClean = cleaned;
  }
  // ---- added joints (children of the chest): Back for the mass behind the body, WingL / WingR at the wing roots
  const chest = I("Spine2"), cw = world[chest], cp = pt(cw), ibmAll = Array.from(ibm);
  const addJoint = (name, at3) => {
    const w = translation(at3), l = decompose(mul(invert(cw), w));
    joints.push({ name, parent: chest, t: l.t, r: l.r, s: l.s }); names.push(name); world.push(w); ibmAll.push(...invert(w));
    return names.length - 1;
  };
  const blend = (i, joint, w) => {               // move w of this vertex's weight onto `joint` (dropping its weakest slot)
    const list = [0, 1, 2, 3].map((k) => [J[i * 4 + k], W[i * 4 + k]]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const sum = list.reduce((n, x) => n + x[1], 0) || 1;
    const out = list.map(([j, x]) => [j, (x / sum) * (1 - w)]).concat([[joint, w]]);
    for (let k = 0; k < 4; k++) { J[i * 4 + k] = out[k] ? out[k][0] : 0; W[i * 4 + k] = out[k] ? out[k][1] : 0; }
  };
  const back = addJoint("Back", [cp[0], neckY - 0.03, cp[2] - 0.07]);
  const zBack = at("Hips")[2] - 0.06;
  for (let i = 0; i < n; i++) {
    const y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (cfg.bulky) break;                      // stone and bark do not swing
    if (tags[i] !== "hair" && !(tags[i] === "body" && z < zBack && y < neckY && !((cfg.skirt || cfg.lit) && /Leg|Foot|Toe/.test(dom0[i])))) continue;   // a realistic figure's calves hang behind the hips too
    const w = Math.max(0, Math.min(1, (neckY - 0.04 - y) / 0.32));
    if (w > 0.02) { blend(i, back, w); count.back = (count.back || 0) + 1; }
  }
  if (cfg.wings && wing.length) {
    // each wing hinges where it meets the back: the chest owns its root, the wing joint the rest (more further out)
    for (const s of ["L", "R"]) {
      const mine = wing.filter((i) => tags[i] === "wing" + s), root = mine.filter((i) => Math.abs(pos[i * 3] - head[0]) < 0.22);
      const avg = (c) => (root.length ? root : mine).reduce((a, i) => a + pos[i * 3 + c], 0) / Math.max(1, (root.length ? root : mine).length);
      const jw = addJoint("Wing" + s, [head[0] + (s === "L" ? 0.07 : -0.07), avg(1), avg(2)]);
      for (const i of mine) { const w = Math.max(0, Math.min(1, (Math.abs(pos[i * 3] - head[0]) - 0.1) / 0.12)); set(i, [["Spine2", 1]]); if (w > 0) blend(i, jw, w); }
    }
  }
  // what the hands hold: a blade's base (at the guard) and tip, and the centre of what the off hand holds
  let blade = null;
  if (cfg.blade && held.R.length) {
    const hand = at("RightHand");
    const tip = held.R.reduce((a, p) => (Math.hypot(...sub(p, hand)) > Math.hypot(...sub(a, hand)) ? p : a), hand);
    const dir = sub(tip, hand).map((x) => x / Math.hypot(...sub(tip, hand)));
    blade = [hand.map((x, i) => x + dir[i] * 0.06), tip];
  }
  const holdL = centre(held.L), holdR = centre(held.R);

  // black specks: triangles whose corners and centre all sample black (they graze a gutter the padding could not reach)
  // take the uv of the nearest vertex that samples colour; the head is left alone (the eyes are black on purpose)
  // probes: every vertex, then 4 inner points per triangle (its centre and halfway from the centre to each corner)
  const T3 = idx.length / 3, INNER = [[1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 6, 1 / 6], [1 / 6, 2 / 3, 1 / 6], [1 / 6, 1 / 6, 2 / 3]];
  const probe = new Float32Array((n + T3 * INNER.length) * 2);
  probe.set(uv.subarray(0, n * 2));
  for (let t = 0; t < T3; t++) INNER.forEach((w, s) => { for (let c = 0; c < 2; c++) probe[(n + t * INNER.length + s) * 2 + c] = w[0] * uv[idx[t * 3] * 2 + c] + w[1] * uv[idx[t * 3 + 1] * 2 + c] + w[2] * uv[idx[t * 3 + 2] * 2 + c]; });
  fs.writeFileSync(path.join(tmp, "uv.f32"), Buffer.from(probe.buffer));
  execFileSync(py, [path.join(__dirname, "model_texture.py"), "--luma", small, path.join(tmp, "uv.f32"), path.join(tmp, "luma.u8")]);
  const luma = fs.readFileSync(path.join(tmp, "luma.u8")); fs.rmSync(tmp, { recursive: true });
  // a triangle whose inside samples black (2+ of its inner probes) while it is not on the head (the eyes are black on purpose) gets three
  // vertices of its own that all sample its brightest corner
  const BLACK = 16, extra = [];                                  // [source vertex, u, v]
  let tri = Array.from(idx);
  for (let t = 0; t < T3; t++) {
    const v = [tri[t * 3], tri[t * 3 + 1], tri[t * 3 + 2]];
    const inner = INNER.filter((_, k) => luma[n + t * INNER.length + k] < BLACK).length;
    if (inner < 2 || v.some((i) => tags[i] === "head")) continue;
    // a speck is a black inside between coloured corners; a triangle of genuinely dark cloth has dark corners too
    if (v.some((i) => luma[i] < 40)) continue;
    const b = v.reduce((a, i) => (luma[i] > luma[a] ? i : a), v[0]);
    v.forEach((i, c) => { extra.push([i, uv[b * 2], uv[b * 2 + 1]]); tri[t * 3 + c] = n + extra.length - 1; });
  }
  if (extra.length) count.specks = extra.length / 3;
  // small holes (retopology sometimes drops a triangle out of a thin sheet such as a wing): weld the vertices by
  // position (uv seams duplicate them), find small closed loops of boundary edges and close each with its own vertices
  {
    const key = new Map(), weld = new Int32Array(n);
    for (let i = 0; i < n; i++) { const k = [0, 1, 2].map((c) => Math.round(pos[i * 3 + c] * 20000)).join(","); if (!key.has(k)) key.set(k, i); weld[i] = key.get(k); }
    const edges = new Map();
    for (let t = 0; t < T3; t++) for (let e = 0; e < 3; e++) {
      const a = weld[idx[t * 3 + e]], b = weld[idx[t * 3 + ((e + 1) % 3)]], k = a < b ? a + ":" + b : b + ":" + a;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
    const nb = new Map();
    for (const [k, c] of edges) if (c === 1) { const [a, b] = k.split(":").map(Number); (nb.get(a) || nb.set(a, []).get(a)).push(b); (nb.get(b) || nb.set(b, []).get(b)).push(a); }
    // each connected piece of the boundary that is a simple loop of at most 12 edges is a hole: fan-fill it
    const fills = [], seen = new Set();
    for (const start of nb.keys()) {
      if (seen.has(start)) continue;
      const comp = [], stack = [start]; seen.add(start);
      while (stack.length) { const v = stack.pop(); comp.push(v); for (const w of nb.get(v)) if (!seen.has(w)) { seen.add(w); stack.push(w); } }
      if (comp.length < 3 || comp.length > 12 || comp.some((v) => nb.get(v).length !== 2)) continue;
      const loop = [comp[0]];
      while (loop.length < comp.length) { const prev = loop[loop.length - 2], cur = loop[loop.length - 1]; loop.push(nb.get(cur).find((w) => w !== prev)); }
      for (let k = 1; k + 1 < loop.length; k++) fills.push([loop[0], loop[k], loop[k + 1]]);
    }
    for (const f of fills) {
      const col = f.reduce((m, i) => (luma[i] > luma[m] ? i : m), f[0]);
      f.forEach((i) => { extra.push([i, uv[col * 2], uv[col * 2 + 1]]); tri.push(n + extra.length - 1); });
    }
    if (fills.length) count.holes = fills.length;
  }
  const N = n + extra.length;
  const src3 = (i, c) => (i < n ? pos[i * 3 + c] : pos[extra[i - n][0] * 3 + c]);
  const srcUV = (i, c) => (i < n ? uv[i * 2 + c] : extra[i - n][1 + c]);
  const srcJ = (i, k) => (i < n ? J[i * 4 + k] : J[extra[i - n][0] * 4 + k]);
  const srcW = (i, k) => (i < n ? W[i * 4 + k] : W[extra[i - n][0] * 4 + k]);

  // ---- quantise
  const lo = [0, 1, 2].map((c) => Math.min(...Array.from({ length: n }, (_, i) => pos[i * 3 + c])));
  const hi = [0, 1, 2].map((c) => Math.max(...Array.from({ length: n }, (_, i) => pos[i * 3 + c])));
  const q = new Uint16Array(N * 3), quv = new Uint16Array(N * 2), qj = new Uint8Array(N * 4), qw = new Uint8Array(N * 4);
  for (let i = 0; i < N; i++) {
    for (let c = 0; c < 3; c++) q[i * 3 + c] = Math.round(((src3(i, c) - lo[c]) / (hi[c] - lo[c] || 1)) * 65535);
    for (let c = 0; c < 2; c++) quv[i * 2 + c] = Math.round(Math.max(0, Math.min(1, srcUV(i, c))) * 65535);
    let s = 0, big = 0;
    for (let k = 0; k < 4; k++) { qj[i * 4 + k] = srcJ(i, k); qw[i * 4 + k] = Math.round(srcW(i, k) * 255); s += qw[i * 4 + k]; if (qw[i * 4 + k] > qw[i * 4 + big]) big = k; }
    qw[i * 4 + big] += 255 - s;
  }
  const wide = N > 65535;                     // a model not retopologised (hundreds of thousands of faces) needs 32-bit indices
  tri = wide ? Uint32Array.from(tri) : Uint16Array.from(tri);
  const parts = [q, quv, qj, qw, tri].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  const bin = Buffer.concat(parts.map((b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)])));

  const r6 = (a) => a.map((x) => +x.toFixed(6));
  const entry = {
    tex: "data:image/jpeg;base64," + tex.toString("base64"), bin: bin.toString("base64"),
    count: N, tris: tri.length / 3, wide: wide ? 1 : 0, lo: r6(lo), hi: r6(hi),
    joints: joints.map((q) => ({ name: q.name, parent: q.parent, t: r6(q.t), r: r6(q.r), s: r6(q.s) })),
    // tq: each joint's world rotation in the rig's T-pose (tools/models/real/<id>.body.glb, turned like the model), what
    // the motion-captured clips (tools/anim_art.mjs) are put on
    ...(cfg.lit ? { tq: tposeOf(id, joints.map((q) => q.name), yawUsed) } : {}),
    ibm: r6(ibmAll), blade: blade && blade.map(r6), hold: { L: holdL && r6(holdL), R: holdR && r6(holdR) }, ...(cfg.style ? { style: cfg.style } : {}),
    // lit: the runtime shades it (smooth normals, light, metal); mt = per vertex what the surface is: 255 what the
    // hands hold and the shield (polished metal), 200 the head (skin), 128 body (its gold trim shines), 0 hair (never
    // metal), 250 an orb (tools/model_prep.cjs marks it: polished like the held things, and the runtime can hide it) — ordered so that blending across a triangle between hair and body never reads as head
    ...(cfg.lit ? { lit: 1, shield: cfg.left === "shield" ? 1 : 0, mt: Buffer.from(Uint8Array.from({ length: N }, (_, i) => { const s0 = i < n ? i : extra[i - n][0], t = tags[s0];
      return orb && orb[s0] ? 250 : /^(held|shield)$/.test(t) ? 255 : isHair(s0) || t === "hair" ? 0 : t === "head" ? 200 : 128; })).toString("base64") } : {}),
  };
  console.log(`${id}: ${N} verts, ${tri.length / 3} tris, ${joints.length} joints, weights ${JSON.stringify(count)}, texture ${Math.round(tex.length / 1024)} KB, mesh ${Math.round(bin.length / 1024)} KB`);
  return entry;
}

/** the rig's T-pose as the auto-rig made it (before tools/model_prep.cjs lowered the arms): each named joint's world
 *  rotation (xyzw, 4 decimals), turned by the model's facing yaw; null for joints the converter added */
function tposeOf(id, names, yaw) {
  const f = path.join(ROOT, "tools", "models", "real", id + ".body.glb");
  if (!fs.existsSync(f)) return null;
  const { j } = readGlb(f), par = new Map(); j.nodes.forEach((nd, i) => (nd.children || []).forEach((c) => par.set(c, i)));
  const trs = (nd) => { if (nd.matrix) return nd.matrix; const [x, y, z, w] = nd.rotation || [0, 0, 0, 1], t = nd.translation || [0, 0, 0], s = nd.scale || [1, 1, 1];
    return [(1 - 2 * (y * y + z * z)) * s[0], 2 * (x * y + z * w) * s[0], 2 * (x * z - y * w) * s[0], 0, 2 * (x * y - z * w) * s[1], (1 - 2 * (x * x + z * z)) * s[1], 2 * (y * z + x * w) * s[1], 0,
      2 * (x * z + y * w) * s[2], 2 * (y * z - x * w) * s[2], (1 - 2 * (x * x + y * y)) * s[2], 0, t[0], t[1], t[2], 1]; };
  const worldOf = (i) => { let m = trs(j.nodes[i]); for (let p = par.get(i); p != null; p = par.get(p)) m = mul(trs(j.nodes[p]), m); return m; };
  const c = Math.cos(-yaw), s_ = Math.sin(-yaw), Ry = [c, 0, -s_, 0, 0, 1, 0, 0, s_, 0, c, 0, 0, 0, 0, 1];
  const byName = new Map(j.nodes.map((nd, i) => [(nd.name || "").replace(/^mixamorig:?/, ""), i]));
  return names.map((nm) => { const i = byName.get(nm); if (i == null) return null; const r = decompose(mul(Ry, worldOf(i))).r; const l = Math.hypot(...r); return r.map((x) => +(x / l).toFixed(4)); });
}

/** a beast (tools/beast_prep.cjs): rigged on its voxel figure's skeleton already, weights clean — only quantised; its
 *  surface is one material (mt: 0 fur, 128 armour plate) */
function beastEntry(id, cfg, { tex, joints, ibm, pos, uv, idx, J, W, n }) {
  const lo = [0, 1, 2].map((c) => { let m = 9; for (let i = 0; i < n; i++) m = Math.min(m, pos[i * 3 + c]); return m; });
  const hi = [0, 1, 2].map((c) => { let m = -9; for (let i = 0; i < n; i++) m = Math.max(m, pos[i * 3 + c]); return m; });
  const q = new Uint16Array(n * 3), quv = new Uint16Array(n * 2), qj = new Uint8Array(n * 4), qw = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) q[i * 3 + c] = Math.round(((pos[i * 3 + c] - lo[c]) / (hi[c] - lo[c] || 1)) * 65535);
    for (let c = 0; c < 2; c++) quv[i * 2 + c] = Math.round(Math.max(0, Math.min(1, uv[i * 2 + c])) * 65535);
    let t = 0, big = 0;
    for (let k = 0; k < 4; k++) { qj[i * 4 + k] = J[i * 4 + k]; qw[i * 4 + k] = Math.round(W[i * 4 + k] * 255); t += qw[i * 4 + k]; if (qw[i * 4 + k] > qw[i * 4 + big]) big = k; }
    qw[i * 4 + big] += 255 - t;
  }
  const wide = n > 65535, tri = wide ? Uint32Array.from(idx) : Uint16Array.from(idx);
  const parts = [q, quv, qj, qw, tri].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  const bin = Buffer.concat(parts.map((b) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4)])));
  const r6 = (a) => Array.from(a, (x) => +x.toFixed(6));
  console.log(`${id}: beast, ${n} verts, ${tri.length / 3} tris, ${joints.length} joints, texture ${Math.round(tex.length / 1024)} KB, mesh ${Math.round(bin.length / 1024)} KB`);
  return {
    tex: "data:image/jpeg;base64," + tex.toString("base64"), bin: bin.toString("base64"),
    count: n, tris: tri.length / 3, wide: wide ? 1 : 0, lo: r6(lo), hi: r6(hi),
    joints: joints.map((j) => ({ name: j.name, parent: j.parent, t: r6(j.t), r: r6(j.r), s: r6(j.s) })), ibm: r6(ibm), hold: {},
    beast: 1, lit: 1, shield: 0, mt: Buffer.alloc(n, cfg.mt ?? 0).toString("base64"),
  };
}

// written in chunks of at most CHUNK bytes (an Artifact serves files up to 15 MB; the build keeps one script per module):
// model-art.js starts the table, model-art-2.js … add to it; the build lists SLOTS of them, unused ones stay empty
const CHUNK = 7.5 * 1024 * 1024, SLOTS = 16;
const files = fs.existsSync(SRC) ? fs.readdirSync(SRC).filter((f) => f.endsWith(".glb")).sort() : [];
const chunks = [[]];
let size = 0;
// a model whose source, whose figure settings and whose converter are unchanged is taken from the cache
// (tools/models/cache, ignored by git with the models); a full conversion takes minutes
const CACHE = path.join(ROOT, "tools", "models", "cache"), crypto = require("crypto");
fs.mkdirSync(CACHE, { recursive: true });
const tool = fs.readFileSync(__filename, "utf8").replace(/const FIGURES = \{[\s\S]*?\n\};/, "") + fs.readFileSync(path.join(__dirname, "model_texture.py"), "utf8");
for (const f of files) {
  const id = path.basename(f, ".glb"), st = fs.statSync(path.join(SRC, f));
  const key = crypto.createHash("sha1").update(tool).update(JSON.stringify(FIGURES[id] || {})).update(`${st.size}:${st.mtimeMs}`).digest("hex").slice(0, 16), cf = path.join(CACHE, `${id}.${key}.json`);
  let entry;
  if (fs.existsSync(cf)) { entry = fs.readFileSync(cf, "utf8"); console.log(`${id}: cached`); }
  else {
    for (const old of fs.readdirSync(CACHE)) if (old.startsWith(id + ".")) fs.rmSync(path.join(CACHE, old));
    entry = JSON.stringify(convert(id, path.join(SRC, f))); fs.writeFileSync(cf, entry);
  }
  const line = `  ${id}: ${entry},`;
  if (size + line.length > CHUNK && chunks[chunks.length - 1].length) { chunks.push([]); size = 0; }
  chunks[chunks.length - 1].push(line); size += line.length;
}
if (chunks.length > SLOTS) throw new Error(`models need ${chunks.length} chunks; the build has ${SLOTS} slots`);
const HEAD = "/* Generated by tools/model_art.cjs from tools/models/figures/*.glb — do not edit. */";
for (let k = 0; k < SLOTS; k++) {
  const out = path.join(ROOT, "src", "presentation", "voxel", k ? `model-art-${k + 1}.js` : "model-art.js");
  const body = (chunks[k] || []).join("\n");
  fs.writeFileSync(out, k ? `${HEAD}\nObject.assign(EmberModelArt, {\n${body}\n});\n` : `${HEAD}\nconst EmberModelArt = {\n${body}\n};\n`);
  console.log(`${path.relative(ROOT, out)}: ${(chunks[k] || []).length} models, ${Math.round(fs.statSync(out).size / 1024)} KB`);
}
