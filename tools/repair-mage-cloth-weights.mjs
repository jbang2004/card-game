// Focused cleanup for this generated mage: hanging cloth below the hands must
// not follow finger bones. Preserve actual arm/hand vertices by geometric bone
// proximity, and preserve every original vertex/index/material/rig transform.
import { readFile, writeFile } from "node:fs/promises";
import { Object3D, Vector3 } from "three";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node tools/repair-mage-cloth-weights.mjs input.glb output.glb",
  );
const raw = await readFile(input),
  jl = raw.readUInt32LE(12),
  gltf = JSON.parse(raw.subarray(20, 20 + jl));
const binary = Buffer.from(raw.subarray(28 + jl));
const nodes = gltf.nodes.map((node) => {
  const o = new Object3D();
  o.name = node.name || "";
  if (node.translation) o.position.fromArray(node.translation);
  if (node.rotation) o.quaternion.fromArray(node.rotation);
  if (node.scale) o.scale.fromArray(node.scale);
  return o;
});
gltf.nodes.forEach((node, i) =>
  node.children?.forEach((j) => nodes[i].add(nodes[j])),
);
gltf.scenes[gltf.scene || 0].nodes.forEach((i) =>
  nodes[i].updateMatrixWorld(true),
);
const primitive = gltf.meshes[0].primitives[0],
  skin = gltf.skins[0];
const joints = skin.joints.map((i) => nodes[i]);
const arm = new Set(
  joints
    .map((joint, i) => (/Arm|Hand|Shoulder/.test(joint.name) ? i : -1))
    .filter((i) => i >= 0),
);
const handPoints = joints
  .filter((joint) => /Hand/.test(joint.name))
  .map((joint) => joint.getWorldPosition(new Vector3()));
const hip = joints.findIndex((joint) => /Hips$/.test(joint.name));
function accessor(name, component, dimensions) {
  const a = gltf.accessors[primitive.attributes[name]],
    v = gltf.bufferViews[a.bufferView];
  if (a.componentType !== component || v.buffer !== 0)
    throw new Error(`Unexpected ${name} accessor`);
  const size = component === 5126 ? 4 : 1;
  return {
    count: a.count,
    offset: v.byteOffset + (a.byteOffset || 0),
    stride: v.byteStride || size * dimensions,
  };
}
const positions = accessor("POSITION", 5126, 3),
  indices = accessor("JOINTS_0", 5121, 4),
  weights = accessor("WEIGHTS_0", 5121, 4);
const meshNode = gltf.nodes.findIndex((node) => node.mesh === 0),
  transform = nodes[meshNode].matrixWorld;
let repaired = 0,
  protectedHandVertices = 0;
const point = new Vector3();
for (let i = 0; i < positions.count; i++) {
  const offset = positions.offset + i * positions.stride;
  point
    .set(
      binary.readFloatLE(offset),
      binary.readFloatLE(offset + 4),
      binary.readFloatLE(offset + 8),
    )
    .applyMatrix4(transform);
  // Source proportions are metres, height .978. The central torso/robe lies
  // inside |z| .145 while original wrists/fingers are out at |z| .20–.25.
  const cloth = point.y < 0.48 || (point.y < 0.64 && Math.abs(point.z) < 0.145);
  if (!cloth) continue;
  const jo = indices.offset + i * indices.stride,
    wo = weights.offset + i * weights.stride;
  let mass = 0;
  const keep = [];
  for (let k = 0; k < 4; k++) {
    const joint = binary[jo + k],
      weight = binary[wo + k];
    if (arm.has(joint)) mass += weight;
    else if (weight) keep.push([joint, weight]);
  }
  if (!mass) continue;
  if (
    handPoints.some((position) => position.distanceToSquared(point) < 0.04 ** 2)
  ) {
    protectedHandVertices++;
    continue;
  }
  keep.sort((a, b) => b[1] - a[1]);
  if (!keep.length) keep.push([hip, 0]);
  keep[0][1] += mass;
  for (let k = 0; k < 4; k++) {
    binary[jo + k] = keep[k]?.[0] || 0;
    binary[wo + k] = keep[k]?.[1] || 0;
  }
  repaired++;
}
gltf.asset.extras ||= {};
if (repaired)
  gltf.asset.extras.emberfallClothRepair = {
    tool: "tools/repair-mage-cloth-weights.mjs",
    repaired,
    protectedHandVertices,
    note: "Removed arm/finger contamination only in hanging cloth/central robe; mass reassigned to strongest original body/leg bone or hips.",
  };
const jr = Buffer.from(JSON.stringify(gltf)),
  json = Buffer.alloc(Math.ceil(jr.length / 4) * 4, 32);
jr.copy(json);
const header = Buffer.alloc(12),
  jh = Buffer.alloc(8),
  bh = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + binary.length, 8);
jh.writeUInt32LE(json.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(binary.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
await writeFile(output, Buffer.concat([header, jh, json, bh, binary]));
console.log(JSON.stringify({ output, repaired, protectedHandVertices }));
