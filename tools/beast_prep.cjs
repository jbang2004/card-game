#!/usr/bin/env node
/* Rig a realistic beast (docs/design/MINIATURES.md) on its voxel figure's own skeleton, so the figure's clips and
 * custom pose (bite, pounce, gore, breath, lunge …) drive the realistic model unchanged.
 *
 *   node tools/beast_prep.cjs [id …]        (every figure in BEASTS when none is named)
 *
 * Input: tools/models/real/<id>.body.glb — a Tripo model, textured and retopologised, exported without a skeleton.
 * Output: tools/models/figures/<id>.glb — the same mesh turned to face +z and scaled to the voxel figure's size,
 * skinned to the voxel figure's bones (same names and hierarchy, rest rotations identity), which tools/model_art.cjs
 * embeds (FIGURES[id].beast).
 *
 * Per beast it
 *   · turns the model to face +z (BEASTS[id].front says where its head points) and scales it so its paws span what
 *     the voxel figure's paws span
 *   · fits the voxel skeleton to the mesh: legs over the paw clusters on the ground, the spine through the middle of
 *     the body, the head chain into the head (the snout tip is the front-most point), tail and wing chains along
 *     their mass (geodesic bands from the root), each joint overridable (BEASTS[id].at)
 *   · skins every vertex to the nearest bone segments (a leg bone only on its own side), smoothed over the mesh;
 *     the jaw takes only the lower jaw (in front of the head joint, below the mouth line)
 * Node built-ins only (the voxel figure files for the skeletons). */
const fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), REAL = path.join(ROOT, "tools", "models", "real"), OUT = path.join(ROOT, "tools", "models", "figures");
const SRC = (f) => path.join(ROOT, "src", f);

// front: where the model's head points as exported; mt: what the surface is for the lit runtime (0 fur, 128 plate);
// at: joint overrides in the fitted model space (after turning and scaling), [x, y, z] or a function of the fit
const BEASTS = {
  wolf: { front: "+z", mt: 0 },
  moonfox: { front: "-x", mt: 0, headYaw: 1.4 },     // its reference turned the head to look at the viewer
  duskstag: { front: "+x", mt: 0, headK: 1.6, headUp: 0 },       // a long muzzle, the head carried level with it
  dragon: { front: "+x", mt: 0, height: 0.62, bodyU: [0.05, 0.45, 0.85], legs: "upright" },   // the voxel whelp sits on its haunches; this one stands
  spider: { front: "+z", mt: 128, abdomenCut: -0.02, snout: [0, 0.24, 0.25], abdomenTip: [0, 0.3, -0.25], rig: {
    root: [0, 0.24, 0.04], head: [0, 0.25, 0.16], abdomen: [0, 0.27, -0.03],
    "fang*": [0.02, 0.19, 0.22], "palp*": [0.035, 0.2, 0.21], "palp*t": [0.05, 0.17, 0.24],
    // five legs a side: the long front pair curls forward; the voxel spider has four, the fifth (between its 2nd and
    // 3rd) rides the body
    "leg1*a": [0.06, 0.22, 0.17], "leg1*b": [0.14, 0.24, 0.27], "leg1*c": [0.14, 0.12, 0.31], "leg1*d": [0.12, 0.03, 0.33],
    "leg2*a": [0.08, 0.22, 0.12], "leg2*b": [0.19, 0.22, 0.18], "leg2*c": [0.205, 0.12, 0.19], "leg2*d": [0.21, 0.035, 0.19],
    "leg5*a": [0.09, 0.22, 0.06], "leg5*b": [0.18, 0.21, 0.065], "leg5*c": [0.185, 0.11, 0.065], "leg5*d": [0.19, 0.025, 0.065],
    "leg3*a": [0.09, 0.22, 0.02], "leg3*b": [0.24, 0.21, 0], "leg3*c": [0.25, 0.12, -0.005], "leg3*d": [0.255, 0.045, -0.01],
    "leg4*a": [0.08, 0.22, -0.04], "leg4*b": [0.17, 0.2, -0.1], "leg4*c": [0.175, 0.13, -0.11], "leg4*d": [0.18, 0.07, -0.12],
  } },
};

// ---- the voxel skeletons (the figure files, as the build loads them)
global.self = global;
global.EmberSculpt = require(SRC("presentation/voxel/sculpt.js"));
global.EmberMeshSimplify = require(SRC("presentation/voxel/simplify.js"));
global.EmberVoxelKit = require(SRC("presentation/voxel/kit.js"));
global.EmberVoxel = require(SRC("presentation/voxel/voxelize.js"));
const build = JSON.parse(fs.readFileSync(path.join(ROOT, "config", "build.json"), "utf8"));
for (const k of Object.keys(build).filter((k) => k.startsWith("VOXEL_FIG_"))) require(SRC(build[k]));
const KIT = global.EmberVoxelKit;
function voxelSkeleton(id) {
  const spec = KIT.get(id);
  KIT.pixel = true;
  try { return spec.build(spec.fam).sc.bones.map((b) => ({ name: b.name, parent: b.parent, head: b.head.slice() })); } finally { KIT.pixel = false; }
}

// ---- glb in / out
const lib = fs.readFileSync(path.join(__dirname, "model_art.cjs"), "utf8");
const readGlb = eval("(" + lib.match(/function readGlb[\s\S]*?\n}/)[0] + ")");
function writeGlb(file, { pos, uv, idx, J, W, bones, img, mime }) {
  const N = pos.length / 3, nodes = [{ name: "Armature", children: [] }];
  bones.forEach((b) => { const p = b.parent >= 0 ? bones[b.parent].head : [0, 0, 0]; nodes.push({ name: b.name, translation: b.head.map((x, c) => x - p[c]), children: [] }); });
  bones.forEach((b, k) => (b.parent < 0 ? nodes[0] : nodes[1 + b.parent]).children.push(1 + k));
  nodes.push({ name: "mesh", mesh: 0, skin: 0 });
  const ibm = new Float32Array(bones.length * 16);
  bones.forEach((b, k) => ibm.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -b.head[0], -b.head[1], -b.head[2], 1], k * 16));
  const bufs = [], views = [], acc = [];
  let off = 0;
  const add = (arr, target) => { const b = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); views.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(target ? { target } : {}) }); bufs.push(b); off += b.length; const pad = (4 - (b.length % 4)) % 4; if (pad) { bufs.push(Buffer.alloc(pad)); off += pad; } return views.length - 1; };
  const accessor = (arr, type, ct, count, o = {}) => { acc.push({ bufferView: add(arr, o.target), componentType: ct, count, type, ...(o.minmax || {}) }); return acc.length - 1; };
  const lo = [0, 1, 2].map((c) => { let m = 9; for (let i = 0; i < N; i++) m = Math.min(m, pos[i * 3 + c]); return m; });
  const hi = [0, 1, 2].map((c) => { let m = -9; for (let i = 0; i < N; i++) m = Math.max(m, pos[i * 3 + c]); return m; });
  const aP = accessor(pos, "VEC3", 5126, N, { minmax: { min: lo, max: hi }, target: 34962 }), aU = accessor(uv, "VEC2", 5126, N, { target: 34962 });
  const aJ = accessor(J, "VEC4", 5121, N, { target: 34962 }), aW = accessor(W, "VEC4", 5126, N, { target: 34962 }), aI = accessor(idx, "SCALAR", 5125, idx.length, { target: 34963 });
  const aB = accessor(ibm, "MAT4", 5126, bones.length), iv = add(img);
  const gl = { asset: { version: "2.0", generator: "tools/beast_prep.cjs" }, scene: 0, scenes: [{ nodes: [0, nodes.length - 1] }], nodes,
    meshes: [{ primitives: [{ attributes: { POSITION: aP, TEXCOORD_0: aU, JOINTS_0: aJ, WEIGHTS_0: aW }, indices: aI, material: 0 }] }],
    skins: [{ joints: bones.map((_, k) => 1 + k), inverseBindMatrices: aB, skeleton: 0 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 }, doubleSided: true }],
    textures: [{ source: 0, sampler: 0 }], samplers: [{}], images: [{ bufferView: iv, mimeType: mime }],
    buffers: [{ byteLength: off }], bufferViews: views, accessors: acc };
  const bin = Buffer.concat(bufs);
  let js = Buffer.from(JSON.stringify(gl)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]));
}

// ---- small vector helpers
const sub = (a, b) => a.map((x, i) => x - b[i]), addv = (a, b) => a.map((x, i) => x + b[i]), mulv = (a, k) => a.map((x) => x * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(...a), lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const avg = (l) => (l.length ? [0, 1, 2].map((c) => l.reduce((s, p) => s + p[c], 0) / l.length) : null);
function segDist(p, a, b) { const ab = sub(b, a), L = dot(ab, ab), t = L ? Math.max(0, Math.min(1, dot(sub(p, a), ab) / L)) : 0; return len(sub(p, addv(a, mulv(ab, t)))); }

/** mesh adjacency over welded vertices (uv seams split a vertex into several at one position) */
function adjacency(pos, idx) {
  const n = pos.length / 3, key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) { const k = [0, 1, 2].map((c) => Math.round(pos[i * 3 + c] * 1e5)).join(); if (!key.has(k)) key.set(k, i); weld[i] = key.get(k); }
  const nb = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let a = 0; a < 3; a++) { const u = weld[idx[t + a]], v = weld[idx[t + ((a + 1) % 3)]]; if (u !== v) { nb[u].add(v); nb[v].add(u); } }
  return { weld, nb: nb.map((s) => [...s]) };
}
/** geodesic (edge-length) distances from the seed vertices over the welded mesh, limited to `allow` */
function geodesic(pos, A, seeds, allow) {
  const n = pos.length / 3, d = new Float64Array(n).fill(Infinity), P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const heap = [];
  const push = (i, v) => { heap.push([v, i]); let k = heap.length - 1; while (k) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  for (const s of seeds) { const w = A.weld[s]; if (d[w] > 0) { d[w] = 0; push(w, 0); } }
  while (heap.length) {
    const [v, i] = pop(); if (v > d[i]) continue;
    for (const j of A.nb[i]) { if (allow && !allow(j)) continue; const nv = v + len(sub(P(i), P(j))); if (nv < d[j]) { d[j] = nv; push(j, nv); } }
  }
  return (i) => d[A.weld[i]];
}

function prep(id, cfg) {
  const G = readGlb(path.join(REAL, id + ".body.glb")), prim = G.j.meshes[0].primitives[0];
  const pos = Float32Array.from(G.read(prim.attributes.POSITION)), uv = Float32Array.from(G.read(prim.attributes.TEXCOORD_0)), idx = Uint32Array.from(G.read(prim.indices));
  const n = pos.length / 3, P = (i) => [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  const texI = G.j.textures[G.j.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source;
  const img = G.image(texI), mime = G.j.images[texI].mimeType || "image/jpeg";

  // ---- turn to face +z, feet on y = 0, centred over the paws
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], z = pos[i * 3 + 2];
    if (cfg.front === "+x") { pos[i * 3] = -z; pos[i * 3 + 2] = x; }
    else if (cfg.front === "-x") { pos[i * 3] = z; pos[i * 3 + 2] = -x; }
    else if (cfg.front === "-z") { pos[i * 3] = -x; pos[i * 3 + 2] = -z; }
  }
  const T = voxelSkeleton(id), TI = Object.fromEntries(T.map((b, i) => [b.name, i])), th = (nm) => T[TI[nm]].head;
  const quad = "fpawL" in TI;
  let minY = Infinity, maxY = -Infinity; for (let i = 0; i < n; i++) { minY = Math.min(minY, pos[i * 3 + 1]); maxY = Math.max(maxY, pos[i * 3 + 1]); }
  for (let i = 0; i < n; i++) pos[i * 3 + 1] -= minY;
  const H = maxY - minY;
  // the feet: vertices on the ground, grouped by side and by front / back (quadrupeds) or into the leg tips (spider)
  const low = []; for (let i = 0; i < n; i++) if (pos[i * 3 + 1] < 0.035 * H) low.push(i);
  const lowC = avg(low.map(P));
  let s, dx = 0, dz = 0;
  const paws = {};
  if (quad) {
    for (const sd of ["L", "R"]) for (const fb of ["f", "b"]) {
      // the voxel figure's left is +x
      const g = low.filter((i) => (sd === "L" ? pos[i * 3] > lowC[0] : pos[i * 3] <= lowC[0]) && (fb === "f" ? pos[i * 3 + 2] > lowC[2] : pos[i * 3 + 2] <= lowC[2]));
      paws[fb + "paw" + sd] = avg(g.map(P));
    }
    const mz = (paws.fpawL[2] + paws.fpawR[2]) / 2 - (paws.bpawL[2] + paws.bpawR[2]) / 2, tz = th("fpawL")[2] - th("bpawL")[2];
    s = cfg.height ? cfg.height / H : tz / mz;
    dx = -lowC[0]; dz = th("bpawL")[2] - ((paws.bpawL[2] + paws.bpawR[2]) / 2) * s;
  } else {
    // a spider: as tall as the voxel one's knees are high, centred on its root
    const knee = Math.max(...T.filter((b) => /^leg\dLb$/.test(b.name)).map((b) => b.head[1]));
    let zlo = 9, zhi = -9, xlo = 9, xhi = -9; for (let i = 0; i < n; i++) { zlo = Math.min(zlo, pos[i * 3 + 2]); zhi = Math.max(zhi, pos[i * 3 + 2]); xlo = Math.min(xlo, pos[i * 3]); xhi = Math.max(xhi, pos[i * 3]); }
    s = (knee * 1.25) / H; dx = -(xlo + xhi) / 2; dz = th("root")[2] - ((zlo + zhi) / 2) * s;
  }
  for (let i = 0; i < n; i++) { pos[i * 3] = (pos[i * 3] + dx) * s; pos[i * 3 + 1] *= s; pos[i * 3 + 2] = pos[i * 3 + 2] * s + dz; }
  for (const k in paws) paws[k] = [(paws[k][0] + dx) * s, 0, paws[k][2] * s + dz];
  const A = adjacency(pos, idx);

  // ---- fit the skeleton (twice when the head has to be turned straight first)
  const J = T.map((b) => ({ name: b.name, parent: b.parent, head: b.head.slice() }));
  const set = (nm, p) => { if (nm in TI) J[TI[nm]].head = p.slice(); };
  const get = (nm) => J[TI[nm]].head;
  const bbox = (ids) => { const lo = [9, 9, 9], hi = [-9, -9, -9]; for (const i of ids) for (let c = 0; c < 3; c++) { lo[c] = Math.min(lo[c], pos[i * 3 + c]); hi[c] = Math.max(hi[c], pos[i * 3 + c]); } return { lo, hi }; };
  const all = Array.from({ length: n }, (_, i) => i);
  const fit = () => {
  J.length = T.length; J.forEach((b, i) => (b.head = T[i].head.slice()));
  if (quad) {
    const fz = (paws.fpawL[2] + paws.fpawR[2]) / 2, bz = (paws.bpawL[2] + paws.bpawR[2]) / 2, L = fz - bz;
    // the trunk between the legs: its top (the back) and bottom (the belly) at the shoulders, the middle and the hips
    const slab = (z0, w) => all.filter((i) => Math.abs(pos[i * 3 + 2] - z0) < w && Math.abs(pos[i * 3]) < 0.6 * Math.abs(paws.fpawL[0] - paws.fpawR[0]) + 0.02);
    const trunk = (z0) => {
      // along the centre line (between the legs nothing reaches down there): the back is its top, the belly its bottom
      const g = slab(z0, 0.05 * L).filter((i) => Math.abs(pos[i * 3]) < 0.015); if (!g.length) return null;
      const ys = g.map((i) => pos[i * 3 + 1]).sort((a, b) => a - b), top = ys[Math.floor(ys.length * 0.97)], belly = ys[Math.floor(ys.length * 0.03)];
      return { top, belly, mid: (top + belly) / 2 };
    };
    const tf = trunk(fz), tm = trunk((fz + bz) / 2), tb = trunk(bz);
    const kz = cfg.height ? s : L / (th("fpawL")[2] - th("bpawL")[2]);
    const zOf = (t) => bz + (t - th("bpawL")[2]) * kz;     // the voxel figure's z → the model's
    const midAt = (z) => { const u = Math.max(0, Math.min(1, (z - bz) / L)); return u < 0.5 ? tb.mid + (tm.mid - tb.mid) * u * 2 : tm.mid + (tf.mid - tm.mid) * (u - 0.5) * 2; };
    ["root", "spine", "chest"].forEach((nm, k) => { const z = cfg.bodyU ? bz + cfg.bodyU[k] * L : zOf(th(nm)[2]); set(nm, [0, midAt(z), z]); });
    // legs: shoulder / hip at the trunk's middle over the paw, the lower joints spaced as the voxel figure's are
    for (const sd of ["L", "R"]) {
      for (const [top, mid, low, paw, t] of [["scap", "elb", "wri", "fpaw", tf], ["hip", "stif", "hock", "bpaw", tb]]) {
        const pw = paws[paw + sd], y0 = th(top + sd)[1], yp = th(paw + sd)[1], top3 = [pw[0] * 0.8, t.mid, zOf(th(top + sd)[2])];
        // upright legs (a standing beast whose voxel figure sits): the joints over the paw, knee forward / hock back
        const up = { elb: -0.08, wri: 0.02, stif: 0.1, hock: -0.08 };
        if (cfg.legs === "upright") top3[2] = pw[2];
        const at = (nm) => { const v = th(nm + sd), u = (v[1] - yp) / (y0 - yp); return [lerp([pw[0], 0, pw[2]], top3, u)[0], yp * s + (t.mid - yp * s) * u, cfg.legs === "upright" ? pw[2] + up[nm] * t.mid : pw[2] + (zOf(v[2]) - zOf(th(paw + sd)[2]))]; };
        set(top + sd, top3); set(mid + sd, at(mid)); set(low + sd, at(low)); set(paw + sd, [pw[0], th(paw + sd)[1] * s * 0.8, pw[2]]);
      }
    }
    // head: the snout tip is the front-most point above the chest; the head joint sits a head-length behind it
    const chest = get("chest"), front = all.filter((i) => pos[i * 3 + 1] > chest[1] * 0.9);
    let tip = front[0]; for (const i of front) if (pos[i * 3 + 2] > pos[tip * 3 + 2]) tip = i;
    const T0 = P(tip), hl = Math.max(0.05, (th("jaw")[2] - th("head")[2]) * 1.6 * s * (cfg.headK || 1));
    const skull = all.filter((i) => pos[i * 3 + 2] > T0[2] - hl * 1.6 && pos[i * 3 + 1] > chest[1]);
    const sb = bbox(skull), hy = (sb.lo[1] + Math.min(sb.hi[1], T0[1] + hl)) / 2;
    const head = [0, cfg.headUp != null ? T0[1] + cfg.headUp * hl : Math.min(hy, T0[1] + 0.45 * hl), T0[2] - hl * 1.05], jaw = [0, T0[1] - 0.22 * hl, T0[2] - hl * 0.6];
    cfg._snout = T0; cfg._hl = hl;
    set("head", head); set("jaw", jaw); set("neck", lerp(chest, head, 0.45));
    for (const sd of ["L", "R"]) {
      const e = th("ear" + sd), h0 = th("head"), sg = sd === "L" ? 1 : -1;
      // an ear is the highest point on its side of the skull (antlered heads keep the voxel figure's ears)
      const cand = "antlerL" in TI ? [] : all.filter((i) => sg * pos[i * 3] > 0.004 && Math.abs(pos[i * 3 + 2] - head[2]) < hl * 0.9 && pos[i * 3 + 1] > head[1]);
      const tipI = cand.reduce((m, i) => (m < 0 || pos[i * 3 + 1] > pos[m * 3 + 1] ? i : m), -1);
      if (tipI >= 0 && pos[tipI * 3 + 1] > head[1] + 0.03) { const tp = P(tipI); set("ear" + sd, lerp([sg * 0.012, head[1], head[2]], tp, 0.45)); cfg["_earTip" + sd] = tp; }
      else set("ear" + sd, [Math.sign(e[0]) * Math.max(0.018, Math.abs(e[0]) * s), head[1] + (e[1] - h0[1]) * s * 0.6, head[2] + (e[2] - h0[2]) * s]);
    }
    for (const sd of ["L", "R"]) if ("antler" + sd in TI) { const e = th("antler" + sd), h0 = th("head"); set("antler" + sd, [(e[0]) * s, head[1] + (e[1] - h0[1]) * s * 0.8, head[2] + (e[2] - h0[2]) * s]); }
    // tail: the mass behind the hips, joints on geodesic bands from its root
    const root = get("root"), hipZ = Math.min(get("hipL")[2], get("hipR")[2]);
    const tailIds = all.filter((i) => pos[i * 3 + 2] < hipZ - 0.02 && pos[i * 3 + 1] > tb.belly * 0.6);
    const tails = T.filter((b) => /^tail\d$/.test(b.name)).map((b) => b.name);
    if (tailIds.length > 30 && tails.length) {
      const inTail = new Set(tailIds.map((i) => A.weld[i])), near = tailIds.filter((i) => pos[i * 3 + 2] > hipZ - 0.05);
      const gd = geodesic(pos, A, near.length ? near : tailIds.slice(0, 10), (j) => inTail.has(j));
      const ds = tailIds.map(gd).filter(Number.isFinite), dmax = Math.max(...ds);
      const band = (u, w) => avg(tailIds.filter((i) => Math.abs(gd(i) - u * dmax) < w * dmax).map(P));
      tails.forEach((nm, k) => { const u = k / tails.length; const p = k === 0 ? [0, band(0.04, 0.05)?.[1] ?? root[1], hipZ - 0.02] : band(u, 0.06); if (p) set(nm, p); });
      cfg._tailTip = band(0.97, 0.03);
    }
    // wings: the membrane out to either side above the back; the arm bones at the root, the elbow, the tip
    if ("wing1L" in TI) {
      for (const sd of ["L", "R"]) {
        const sg = sd === "L" ? 1 : -1, bw = Math.abs(paws.fpawL[0] - paws.fpawR[0]) * 0.6;
        const ids = all.filter((i) => sg * pos[i * 3] > bw && pos[i * 3 + 1] > tf.mid);
        const b = bbox(ids), far = ids.reduce((m, i) => (sg * pos[i * 3] > sg * pos[m * 3] ? i : m), ids[0]);
        const r0 = [sg * bw, tf.top, get("chest")[2] - 0.01], tipP = P(far);
        const elbow = avg(ids.filter((i) => Math.abs(sg * pos[i * 3] - (bw + (sg * tipP[0] - bw) * 0.45)) < 0.02).filter((i) => pos[i * 3 + 1] > (b.lo[1] + b.hi[1]) / 2).map(P)) || lerp(r0, tipP, 0.45);
        set("wing1" + sd, r0); set("wing2" + sd, elbow); set("wing3" + sd, lerp(elbow, tipP, 0.7));
        for (const f of ["wf1", "wf2", "wf3"]) set(f + sd, lerp(elbow, tipP, 0.7));
        cfg["_wingTip" + sd] = tipP;
      }
    }
  } else {
    // a spider: joints read off the model's views (cfg.rig, the left side; the right mirrors it). Extra legs the
    // voxel skeleton lacks get their own chain on the root (no clip moves them: they ride the body)
    for (const [nm, p] of Object.entries(cfg.rig)) {
      for (const [sd, sg] of [["L", 1], ["R", -1]]) {
        const name = nm.replace("*", sd), q = [sg * p[0], p[1], p[2]];
        if (!(name in TI)) { const par = /^(leg\d[LR])([b-d])$/.exec(name); J.push({ name, parent: par ? TI[par[1] + String.fromCharCode(par[2].charCodeAt(0) - 1)] : TI.root, head: q }); TI[name] = J.length - 1; }
        else set(name, q);
        if (!nm.includes("*")) break;
      }
    }
    cfg._snout = cfg.snout; cfg._abdomenTip = cfg.abdomenTip;
  }
  for (const [nm, p] of Object.entries(cfg.at || {})) set(nm, typeof p === "function" ? p(get) : p);
  };
  fit();
  // a head the model turned aside (a 3/4 reference) is turned back to face +z: everything above the neck joint and in
  // front of the chest turns about the vertical through the neck, fading in over the neck
  if (cfg.headYaw) {
    const nk = get("neck"), ch = get("chest"), a = -cfg.headYaw, sm = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    for (let i = 0; i < n; i++) {
      const w = sm(nk[1] - 0.02, nk[1] + 0.05, pos[i * 3 + 1]) * sm(ch[2] - 0.06, ch[2], pos[i * 3 + 2]); if (!w) continue;
      const x = pos[i * 3] - nk[0], z = pos[i * 3 + 2] - nk[2], c = Math.cos(a * w), sn = Math.sin(a * w);
      pos[i * 3] = nk[0] + c * x + sn * z; pos[i * 3 + 2] = nk[2] - sn * x + c * z;
    }
    fit();
  }

  // ---- skin: nearest bone segments; a bone's segment runs to its (first) child, a leaf's out to its tip
  const kids = J.map(() => []); J.forEach((b, i) => b.parent >= 0 && kids[b.parent].push(i));
  const tipOf = (i) => {
    const b = J[i], nm = b.name;
    if (nm === "head") return cfg._snout || (get("jaw") ? lerp(b.head, get("jaw"), 1.3) : null);
    if (/^ear/.test(nm)) return cfg["_earTip" + nm.slice(-1)] || addv(b.head, [0, 0.04, 0]);
    if (/^antler/.test(nm)) return addv(b.head, [Math.sign(b.head[0]) * 0.02, 0.12, 0]);
    if (/paw/.test(nm)) return addv(b.head, [0, 0, 0.02]);
    if (nm === "jaw") return addv(b.head, [0, 0, 0.03]);
    if (nm === "abdomen") return cfg._abdomenTip || addv(b.head, [0, 0, -0.1]);
    if (/^leg\d[LR]d$/.test(nm)) return addv(b.head, [0, -0.004, 0]);
    if (/^tail\d$/.test(nm) && !kids[i].length) return cfg._tailTip || addv(b.head, [0, 0, -0.05]);
    if (/^wing3/.test(nm)) return cfg["_wingTip" + nm.slice(-1)] || b.head;
    if (kids[i].length) { const k = kids[i].find((c) => !/^(ear|antler|jaw|wf|tail|scap|hip|wing)/.test(J[c].name)) ?? kids[i][0]; return J[k].head; }
    return b.head;
  };
  const skip = new Set(J.map((b, i) => (/^wf\d/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const segs = J.map((b, i) => [b.head, tipOf(i) || b.head]);
  const sideOf = (nm) => (/[a-z0-9]L[a-z]?$/.test(nm) ? 1 : /[a-z0-9]R[a-z]?$/.test(nm) ? -1 : 0);
  const Wt = new Float32Array(n * J.length);
  const jawI = TI.jaw, headI = TI.head;
  for (let i = 0; i < n; i++) {
    const p = P(i), d = [];
    for (let k = 0; k < J.length; k++) {
      if (skip.has(k)) continue;
      const sd = sideOf(J[k].name); if (sd && sd * p[0] < -0.004) continue;
      if (/^(ear|antler)/.test(J[k].name) && p[1] < J[k].head[1] - 0.006) continue;      // ears and antlers above their base only
      d.push([segDist(p, segs[k][0], segs[k][1]), k]);
    }
    d.sort((a, b) => a[0] - b[0]);
    // antlers are rigid on their side of the skull: everything above their base
    if ("antlerL" in TI && p[1] > get("antlerL")[1] + 0.005) { Wt[i * J.length + TI[p[0] >= 0 ? "antlerL" : "antlerR"]] = 1; continue; }
    // a spider's abdomen is one plate: everything behind the cut that is not a leg
    if (cfg.abdomenCut != null && p[2] < cfg.abdomenCut && Math.abs(p[0]) < 0.13 && p[1] > 0.16) { Wt[i * J.length + TI.abdomen] = 1; continue; }
    const d0 = d[0][0] + 1e-4;
    for (const [dist, k] of d.slice(0, 3)) { const w = Math.pow(d0 / (dist + 1e-4), 4); if (w > 0.05) Wt[i * J.length + k] = w; }
    // the lower jaw alone: under the mouth line (the jaw joint's height), from the hinge forward, near the middle
    if (jawI != null) {
      const jw = get("jaw"), hl = cfg._hl || 0.05, inJaw = p[2] > jw[2] - 0.1 * hl && p[1] < jw[1] && Math.abs(p[0]) < 0.45 * hl;
      const w = Wt[i * J.length + jawI];
      if (w && !inJaw) { Wt[i * J.length + headI] += w; Wt[i * J.length + jawI] = 0; }
      else if (inJaw && p[1] < jw[1] - 0.004) { for (let k = 0; k < J.length; k++) if (/^(head|neck)$/.test(J[k].name)) { Wt[i * J.length + jawI] += Wt[i * J.length + k]; Wt[i * J.length + k] = 0; } }
    }
  }
  // smoothing over the welded mesh (seam copies share their weights)
  const norm = (i) => { let t = 0; for (let k = 0; k < J.length; k++) t += Wt[i * J.length + k]; if (t) for (let k = 0; k < J.length; k++) Wt[i * J.length + k] /= t; };
  for (let i = 0; i < n; i++) norm(i);
  for (let it = 0; it < (cfg.smooth ?? 3); it++) {
    const nx = Float32Array.from(Wt);
    for (let i = 0; i < n; i++) {
      const w = A.weld[i]; if (w !== i) continue;
      const nb = A.nb[i]; if (!nb.length) continue;
      for (let k = 0; k < J.length; k++) { let a = 0; for (const j of nb) a += Wt[j * J.length + k]; nx[i * J.length + k] = 0.5 * Wt[i * J.length + k] + (0.5 * a) / nb.length; }
    }
    Wt.set(nx);
    for (let i = 0; i < n; i++) if (A.weld[i] !== i) for (let k = 0; k < J.length; k++) Wt[i * J.length + k] = Wt[A.weld[i] * J.length + k];
  }
  // four biggest per vertex
  const JI = new Uint8Array(n * 4), WI = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const top = [...Array(J.length).keys()].map((k) => [Wt[i * J.length + k], k]).sort((a, b) => b[0] - a[0]).slice(0, 4);
    const t = top.reduce((a, [w]) => a + w, 0) || 1;
    top.forEach(([w, k], c) => { JI[i * 4 + c] = k; WI[i * 4 + c] = w / t; });
  }
  if (process.env.BEAST_DEBUG) {
    const D = process.env.BEAST_DEBUG, dom = new Uint8Array(n); for (let i = 0; i < n; i++) dom[i] = JI[i * 4];
    fs.writeFileSync(path.join(D, id + ".rpos"), Buffer.from(pos.buffer)); fs.writeFileSync(path.join(D, id + ".dom"), Buffer.from(dom.buffer));
    fs.writeFileSync(path.join(D, id + ".joints.json"), JSON.stringify(J.map((b, i) => ({ name: b.name, head: b.head, parent: b.parent, tip: segs[i][1] }))));
  }
  const out = path.join(OUT, id + ".glb");
  writeGlb(out, { pos, uv, idx, J: JI, W: WI, bones: J, img, mime });
  fs.writeFileSync(path.join(OUT, id + ".joints.json"), JSON.stringify(J.map((b) => ({ name: b.name, head: b.head.map((x) => +x.toFixed(4)) }))));
  const b = bbox(all);
  console.log(`${id}: ${n} verts, scale ${s.toFixed(3)}, size ${sub(b.hi, b.lo).map((x) => x.toFixed(3)).join(" × ")}, ${J.length} bones → ${path.relative(ROOT, out)}`);
}

const want = process.argv.slice(2), ids = want.length ? want : Object.keys(BEASTS);
for (const id of ids) {
  if (!BEASTS[id]) throw new Error(`no BEASTS entry for ${id}`);
  if (!fs.existsSync(path.join(REAL, id + ".body.glb"))) { console.log(`${id}: no ${id}.body.glb yet — skipped`); continue; }
  prep(id, { ...BEASTS[id] });
}
module.exports = { BEASTS };
