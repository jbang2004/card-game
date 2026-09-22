// Offline GLB buffer-view decoding. The decoder's WASM is embedded in Three's
// module; this command never downloads an external decoder or changes poses.
import { readFile, writeFile } from "node:fs/promises";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node tools/decode-hero-meshopt.mjs input.glb output.glb",
  );
const raw = await readFile(input);
if (raw.readUInt32LE(0) !== 0x46546c67 || raw.readUInt32LE(4) !== 2)
  throw new Error("Expected GLB 2.0");
const jsonLength = raw.readUInt32LE(12),
  gltf = JSON.parse(raw.subarray(20, 20 + jsonLength));
const binStart = 28 + jsonLength,
  binary = raw.subarray(binStart, binStart + raw.readUInt32LE(20 + jsonLength));
if (gltf.buffers.some((buffer) => buffer.uri))
  throw new Error("Only self-contained GLB is supported");
await MeshoptDecoder.ready;
const parts = [];
let byteLength = 0,
  decoded = 0;
for (const view of gltf.bufferViews) {
  const compression = view.extensions?.EXT_meshopt_compression;
  let data;
  if (compression) {
    if (compression.buffer !== 0)
      throw new Error("Compressed source is not the GLB binary buffer");
    data = new Uint8Array(compression.count * compression.byteStride);
    MeshoptDecoder.decodeGltfBuffer(
      data,
      compression.count,
      compression.byteStride,
      binary.subarray(
        compression.byteOffset || 0,
        (compression.byteOffset || 0) + compression.byteLength,
      ),
      compression.mode,
      compression.filter,
    );
    delete view.extensions.EXT_meshopt_compression;
    if (!Object.keys(view.extensions).length) delete view.extensions;
    decoded++;
  } else {
    if (view.buffer !== 0)
      throw new Error("Noncompressed view has no embedded binary data");
    data = binary.subarray(
      view.byteOffset || 0,
      (view.byteOffset || 0) + view.byteLength,
    );
  }
  const padding = (4 - (byteLength % 4)) % 4;
  if (padding) {
    parts.push(Buffer.alloc(padding));
    byteLength += padding;
  }
  view.buffer = 0;
  view.byteOffset = byteLength;
  view.byteLength = data.length;
  parts.push(Buffer.from(data));
  byteLength += data.length;
}
gltf.buffers = [{ byteLength }];
for (const key of ["extensionsUsed", "extensionsRequired"])
  if (gltf[key]) {
    gltf[key] = gltf[key].filter(
      (extension) => extension !== "EXT_meshopt_compression",
    );
    if (!gltf[key].length) delete gltf[key];
  }
const jsonRaw = Buffer.from(JSON.stringify(gltf)),
  json = Buffer.alloc(Math.ceil(jsonRaw.length / 4) * 4, 32);
jsonRaw.copy(json);
const binRaw = Buffer.concat(parts),
  bin = Buffer.alloc(Math.ceil(binRaw.length / 4) * 4);
binRaw.copy(bin);
const header = Buffer.alloc(12),
  jsonHeader = Buffer.alloc(8),
  binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
jsonHeader.writeUInt32LE(json.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);
binHeader.writeUInt32LE(bin.length, 0);
binHeader.writeUInt32LE(0x004e4942, 4);
await writeFile(
  output,
  Buffer.concat([header, jsonHeader, json, binHeader, bin]),
);
process.stdout.write(
  JSON.stringify({
    input,
    output,
    decodedBufferViews: decoded,
    bytes: 28 + json.length + bin.length,
  }) + "\n",
);
