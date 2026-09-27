// tools/fbx_to_glb.mjs <in.fbx> <basecolor.jpg> <out.glb> — a Tripo retopology export (FBX, quads) as the GLB tools/beast_prep.cjs
// reads: one mesh, positions + uvs (glTF convention: v down), welded, triangulated, the base colour embedded
import fs from "fs";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
globalThis.self = globalThis;
globalThis.document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} }) };
const [inp, tex, out] = process.argv.slice(2);
const buf = fs.readFileSync(inp);
const root = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), "");
root.updateMatrixWorld(true);
const P = [], U = [], I = [], key = new Map();
root.traverse((m) => {
  if (!m.isMesh) return;
  const g = m.geometry, pa = g.attributes.position, ua = g.attributes.uv, n = pa.count, v = new THREE.Vector3();
  const ix = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
  for (const i of ix) {
    v.fromBufferAttribute(pa, i).applyMatrix4(m.matrixWorld);
    const u = ua.getX(i), w = 1 - ua.getY(i), k = [v.x, v.y, v.z, u, w].map((x) => Math.round(x * 1e5)).join();
    let j = key.get(k);
    if (j == null) { j = P.length / 3; key.set(k, j); P.push(v.x, v.y, v.z); U.push(u, w); }
    I.push(j);
  }
});
const pos = new Float32Array(P), uv = new Float32Array(U), nv = pos.length / 3, idx = nv > 65535 ? new Uint32Array(I) : new Uint16Array(I);
const lo = [0, 1, 2].map((c) => Math.min(...Array.from({ length: nv }, (_, i) => pos[i * 3 + c])));
const hi = [0, 1, 2].map((c) => Math.max(...Array.from({ length: nv }, (_, i) => pos[i * 3 + c])));
// y up from 0, as Tripo's own GLB exports stand
const img = fs.readFileSync(tex);
const bufs = [], views = [], acc = []; let off = 0;
const add = (a, target) => { const b = Buffer.from(a.buffer, a.byteOffset, a.byteLength); views.push({ buffer: 0, byteOffset: off, byteLength: b.length, ...(target ? { target } : {}) }); bufs.push(b); off += b.length; const pad = (4 - (b.length % 4)) % 4; if (pad) { bufs.push(Buffer.alloc(pad)); off += pad; } return views.length - 1; };
acc.push({ bufferView: add(pos, 34962), componentType: 5126, count: nv, type: "VEC3", min: lo, max: hi });
acc.push({ bufferView: add(uv, 34962), componentType: 5126, count: nv, type: "VEC2" });
acc.push({ bufferView: add(idx, 34963), componentType: idx instanceof Uint32Array ? 5125 : 5123, count: idx.length, type: "SCALAR" });
const iv = add(new Uint8Array(img));
const gl = { asset: { version: "2.0", generator: "tools/fbx_to_glb.mjs" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: "mesh", mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 } }], textures: [{ source: 0, sampler: 0 }], samplers: [{}],
  images: [{ bufferView: iv, mimeType: "image/jpeg" }], buffers: [{ byteLength: off }], bufferViews: views, accessors: acc };
const bin = Buffer.concat(bufs);
let js = Buffer.from(JSON.stringify(gl)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
const ch = (len, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(len, 0); b.writeUInt32LE(type, 4); return b; };
fs.writeFileSync(out, Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]));
console.log(`${out}: ${nv} verts, ${idx.length / 3} tris, size ${hi.map((h, c) => (h - lo[c]).toFixed(3)).join(" × ")}, min ${lo.map((x) => x.toFixed(3)).join(",")}`);
