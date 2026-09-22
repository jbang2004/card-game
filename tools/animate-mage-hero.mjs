// Original, short battle performances authored on the existing Tripo/Mixamo
// skeleton. No geometry replacement, external motion clip or rule-state code.
// Re-running against the final GLB is deterministic: recorded source boundaries
// strip our previous channels so the checked-in model is its own source asset.
import { readFile, writeFile } from "node:fs/promises";
import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw new Error(
    "Usage: node tools/animate-mage-hero.mjs input.glb output.glb",
  );
const raw = await readFile(input),
  jsonLength = raw.readUInt32LE(12);
const gltf = JSON.parse(raw.subarray(20, 20 + jsonLength));
if (gltf.extensionsRequired?.includes("EXT_meshopt_compression"))
  throw new Error("Decode meshopt first");
const prior = gltf.asset.extras?.emberfallAnimationSource;
const source = prior || {
  byteLength: gltf.buffers[0].byteLength,
  bufferViews: gltf.bufferViews.length,
  accessors: gltf.accessors.length,
};
gltf.bufferViews.length = source.bufferViews;
gltf.accessors.length = source.accessors;
const chunks = [
  raw.subarray(28 + jsonLength, 28 + jsonLength + source.byteLength),
];
let byteLength = source.byteLength;
const objects = gltf.nodes.map((node) => {
  const object = new Object3D();
  object.name = node.name || "";
  if (node.translation) object.position.fromArray(node.translation);
  if (node.rotation) object.quaternion.fromArray(node.rotation).normalize();
  if (node.scale) object.scale.fromArray(node.scale);
  return object;
});
gltf.nodes.forEach((node, index) =>
  node.children?.forEach((child) => objects[index].add(objects[child])),
);
const roots = gltf.scenes[gltf.scene || 0].nodes.map((index) => objects[index]);
const update = () => roots.forEach((root) => root.updateMatrixWorld(true));
const rest = objects.map((object) => object.quaternion.clone());
const names = new Map(
  objects.map((object, index) => [
    object.name.replace("mixamorig:", ""),
    index,
  ]),
);
const animated = new Set();
const axes = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};
function rotate(name, axis, angle) {
  const index = names.get(name);
  if (index === undefined) throw new Error(`Missing bone: ${name}`);
  const object = objects[index],
    parent =
      object.parent?.getWorldQuaternion(new Quaternion()) || new Quaternion();
  const world = object.getWorldQuaternion(new Quaternion());
  const delta = new Quaternion().setFromAxisAngle(axes[axis], angle);
  object.quaternion
    .copy(parent.invert().multiply(delta.multiply(world)))
    .normalize();
  animated.add(index);
  update();
}
const restPositions = objects.map((object) => object.position.clone());
update();
const bone = (name) => objects[names.get(name)];
const point = (name) => bone(name).getWorldPosition(new Vector3());
const feet = ["Left", "Right"].map((side) => ({
  side,
  point: point(`${side}Foot`),
  orientation: bone(`${side}Foot`).getWorldQuaternion(new Quaternion()),
}));
const palms = new Map();
for (const side of ["Left", "Right"]) {
  const hand = bone(`${side}Hand`),
    inverse = hand.getWorldQuaternion(new Quaternion()).invert();
  const fingers = point(`${side}HandMiddle1`)
    .sub(point(`${side}Hand`))
    .normalize();
  const normal = point(`${side}HandIndex1`)
    .sub(point(`${side}Hand`))
    .cross(point(`${side}HandPinky1`).sub(point(`${side}Hand`)))
    .normalize();
  if (normal.x < 0) normal.negate();
  normal.addScaledVector(fingers, -normal.dot(fingers)).normalize();
  const basis = new Matrix4().makeBasis(
    fingers.clone().cross(normal),
    fingers,
    normal,
  );
  palms.set(
    side,
    new Quaternion().setFromRotationMatrix(basis).premultiply(inverse).invert(),
  );
}
function worldRotation(name, q) {
  const obj = bone(name),
    parent = obj.parent.getWorldQuaternion(new Quaternion());
  obj.quaternion.copy(parent.invert().multiply(q)).normalize();
  animated.add(names.get(name));
  update();
}
function aim(name, child, target) {
  const from = point(child).sub(point(name)).normalize();
  const to = target.clone().sub(point(name)).normalize();
  worldRotation(
    name,
    new Quaternion()
      .setFromUnitVectors(from, to)
      .multiply(bone(name).getWorldQuaternion(new Quaternion())),
  );
}
// Analytic two-bone IK keeps the feet planted while the body shifts weight,
// and keeps both hands in readable space in front of the robe.
function ik(upper, lower, end, target, hint) {
  const start = point(upper),
    middle = point(lower),
    finish = point(end);
  const a = start.distanceTo(middle),
    b = middle.distanceTo(finish);
  const direction = target.clone().sub(start);
  const d = Math.max(
    Math.abs(a - b) + 1e-5,
    Math.min(a + b - 1e-5, direction.length()),
  );
  direction.normalize();
  const along = (a * a - b * b + d * d) / (2 * d);
  const height = Math.sqrt(Math.max(0, a * a - along * along));
  const outward = hint.clone().sub(start);
  outward.addScaledVector(direction, -outward.dot(direction)).normalize();
  const elbow = start
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(outward, height);
  aim(upper, lower, elbow);
  aim(lower, end, start.clone().addScaledVector(direction, d));
}
const smooth = (value) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
// Left hand is anchored to the waist in torso-local space. Its elbow can
// stay open while the torso turns, rather than swimming around a world target.
const waistBone = bone("Spine1");
const waistPoint = waistBone.worldToLocal(new Vector3(0.047, 0.642, -0.096));
const waistRestRotation = waistBone.getWorldQuaternion(new Quaternion());
const ready = {
  hips: [0, 0, -0.004],
  hipTurn: -0.025,
  hipRoll: 0.008,
  lean: 0.015,
  turn: 0.045,
  side: 0.008,
  right: [0.055, 0.552, 0.15],
  rightElbow: [0.01, 0.655, 0.28],
  left: [0.047, 0.642, -0.096],
  present: 0,
  head: 0.035,
  headTurn: 0,
};
const key = (t, options = {}) => ({ t, ...ready, ...options });
const castKeys = [
  key(0),
  // Hips lead the wind-up. The hand starts behind/below the shoulder.
  key(0.12, {
    hips: [-0.003, 0, -0.007],
    hipTurn: -0.105,
    lean: 0.045,
    turn: -0.1,
    right: [-0.018, 0.602, 0.155],
    rightElbow: [-0.075, 0.675, 0.24],
    present: 0,
    head: 0.04,
    headTurn: 0.12,
  }),
  key(0.25, {
    hips: [-0.002, 0, -0.006],
    hipTurn: -0.06,
    lean: 0.055,
    turn: -0.24,
    side: -0.025,
    right: [0.02, 0.69, 0.185],
    rightElbow: [-0.06, 0.725, 0.26],
    present: 0,
    head: 0.03,
    headTurn: 0.08,
  }),
  // The torso follows; elbow and wrist describe a broad upward arc.
  key(0.4, {
    hips: [0.003, 0, -0.004],
    hipTurn: 0.075,
    lean: -0.02,
    turn: -0.075,
    side: -0.008,
    right: [0.12, 0.835, 0.18],
    rightElbow: [0.02, 0.71, 0.26],
    present: 0.15,
    head: 0.01,
    headTurn: 0.045,
  }),
  key(0.55, {
    hips: [0.006, 0, -0.003],
    hipTurn: 0.065,
    lean: -0.085,
    turn: 0.195,
    side: 0.018,
    right: [0.29, 0.765, 0.11],
    present: 1,
    head: 0.025,
    headTurn: -0.04,
  }),
  // Shoulder/wrist finish after the hips; slight overshoot, never a squat.
  key(0.68, {
    hips: [0.004, 0, -0.003],
    hipTurn: 0.025,
    lean: -0.095,
    turn: 0.23,
    side: 0.024,
    right: [0.295, 0.7, 0.115],
    present: 0.94,
    head: 0.04,
    headTurn: 0.05,
  }),
  key(0.92, {
    hips: [0, 0, -0.004],
    hipTurn: -0.045,
    lean: 0.015,
    turn: 0.09,
    right: [0.205, 0.575, 0.165],
    present: 0.38,
    head: 0.045,
    headTurn: 0.012,
  }),
  key(1.22, {
    hips: [0, 0, -0.004],
    hipTurn: -0.03,
    lean: 0.027,
    turn: 0.02,
    right: [0.065, 0.538, 0.145],
    present: 0.02,
    head: 0.038,
    headTurn: -0.007,
  }),
  key(1.6),
];
const hitKeys = [
  key(0),
  key(0.1, {
    hips: [-0.005, -0.004, -0.009],
    hipTurn: 0.04,
    lean: 0.135,
    turn: 0.12,
    side: -0.025,
    right: [0.115, 0.635, 0.17],
    present: 0.45,
    head: 0.11,
    headTurn: 0.035,
  }),
  key(0.22, {
    hips: [-0.003, -0.003, -0.008],
    hipTurn: 0.018,
    lean: 0.1,
    turn: 0.08,
    side: -0.018,
    right: [0.105, 0.625, 0.165],
    present: 0.35,
    head: 0.13,
    headTurn: 0.02,
  }),
  key(0.42, {
    hips: [0.001, 0, -0.003],
    hipTurn: -0.033,
    lean: -0.025,
    turn: 0.02,
    side: 0.012,
    right: [0.075, 0.565, 0.165],
    present: 0.08,
    head: 0.01,
    headTurn: -0.01,
  }),
  key(0.78),
];
function interpolate(keys, t) {
  if (t >= keys.at(-1).t) return keys.at(-1);
  const i = Math.max(
    0,
    keys.findIndex((k, j) => j < keys.length - 1 && t <= keys[j + 1].t),
  );
  const a = keys[i],
    b = keys[i + 1],
    duration = b.t - a.t,
    f = Math.max(0, (t - a.t) / duration);
  // Monotone Hermite curves preserve the pose keys without stopping at every
  // key. Derivatives agree on both sides; extrema settle without overshoot.
  const sample = (read) => {
    const slope = (index) => {
      if (index === 0 || index === keys.length - 1) return 0;
      const before =
        (read(keys[index]) - read(keys[index - 1])) /
        (keys[index].t - keys[index - 1].t);
      const after =
        (read(keys[index + 1]) - read(keys[index])) /
        (keys[index + 1].t - keys[index].t);
      return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
    };
    return (
      (2 * f * f * f - 3 * f * f + 1) * read(a) +
      (f * f * f - 2 * f * f + f) * duration * slope(i) +
      (-2 * f * f * f + 3 * f * f) * read(b) +
      (f * f * f - f * f) * duration * slope(i + 1)
    );
  };
  return Object.fromEntries(
    Object.keys(ready).map((k) => [
      k,
      Array.isArray(a[k])
        ? a[k].map((_, j) => sample((key) => key[k][j]))
        : sample((key) => key[k]),
    ]),
  );
}
function palmRotation(finger, normal) {
  finger.normalize();
  normal.addScaledVector(finger, -normal.dot(finger)).normalize();
  return new Quaternion().setFromRotationMatrix(
    new Matrix4().makeBasis(finger.clone().cross(normal), finger, normal),
  );
}
const releaseRightPalm = palmRotation(
  new Vector3(0, 1, -0.1),
  new Vector3(1, 0, 0),
);
function pose(kind, t) {
  objects.forEach((object, i) => {
    object.quaternion.copy(rest[i]);
    object.position.copy(restPositions[i]);
  });
  update();
  let p;
  if (kind === "idle") {
    const phase = (t / 4.4) * Math.PI * 2;
    // Small independent rhythms: slow thoracic breathing, delayed wrist
    // settling and a second-harmonic head adjustment. Endpoints still match.
    const breathe = Math.sin(phase - 0.35) - Math.sin(-0.35);
    const weight = Math.sin(phase + 0.7) - Math.sin(0.7);
    const wrist = Math.sin(phase - 0.95) - Math.sin(-0.95);
    const glance = Math.sin(phase * 2 + 0.25) - Math.sin(0.25);
    p = {
      ...ready,
      hips: [0, 0, -0.004 + 0.0015 * weight],
      hipTurn: -0.025 + 0.006 * weight,
      lean: 0.015 + 0.012 * breathe,
      turn: 0.045 + 0.022 * breathe,
      side: 0.008 - 0.01 * weight,
      right: [
        0.055 + 0.01 * wrist,
        0.552 + 0.009 * wrist,
        0.15 + 0.005 * breathe,
      ],
      present: 0.014 * (Math.cos(0.3) - Math.cos(phase - 0.3)),
      head: 0.035 + 0.01 * glance,
      headTurn: 0.012 * glance,
    };
  } else p = interpolate(kind === "cast" ? castKeys : hitKeys, t);
  const hips = bone("Hips");
  hips.position.copy(
    hips.parent.worldToLocal(point("Hips").add(new Vector3(...p.hips))),
  );
  update();
  rotate("Hips", "y", p.hipTurn);
  rotate("Hips", "x", p.hipRoll);
  rotate("Spine", "z", p.lean * 0.28);
  rotate("Spine1", "z", p.lean * 0.34);
  rotate("Spine2", "z", p.lean * 0.38);
  rotate("Spine1", "x", p.side * 0.45);
  rotate("Spine2", "x", p.side * 0.55);
  rotate("Spine1", "y", p.turn * 0.36);
  rotate("Spine2", "y", p.turn * 0.46);
  rotate("Neck", "y", -p.turn * 0.3 + p.headTurn);
  rotate("Head", "z", p.head);
  for (const { side, point: target, orientation } of feet) {
    ik(
      `${side}UpLeg`,
      `${side}Leg`,
      `${side}Foot`,
      target,
      new Vector3(0.4, 0.3, side === "Left" ? -0.08 : 0.08),
    );
    worldRotation(`${side}Foot`, orientation.clone());
  }
  for (const side of ["Left", "Right"]) {
    const sign = side === "Left" ? -1 : 1;
    const target =
      side === "Left"
        ? waistBone.localToWorld(waistPoint.clone())
        : new Vector3(...p.right);
    const hint =
      side === "Left"
        ? new Vector3(-0.02, 0.685, -0.32)
        : new Vector3(...p.rightElbow);
    ik(`${side}Arm`, `${side}ForeArm`, `${side}Hand`, target, hint);
    let q;
    if (side === "Left") {
      // Fingers fall along the outer hip, palm resting inward on the waist.
      q = palmRotation(new Vector3(0.18, -1, -0.04), new Vector3(0, 0, 1));
      q.premultiply(
        waistBone
          .getWorldQuaternion(new Quaternion())
          .multiply(waistRestRotation.clone().invert()),
      );
    } else {
      // Quaternion interpolation avoids a palm-basis flip midway through the
      // wrist turn. Relaxed palm faces the thigh; release palm faces forward.
      q = palmRotation(
        point("RightHand").sub(point("RightForeArm")),
        new Vector3(0, 0, -1),
      ).slerp(releaseRightPalm, p.present);
    }
    worldRotation(`${side}Hand`, q.multiply(palms.get(side)));
    for (const digit of ["Index", "Middle", "Ring", "Pinky"]) {
      const index = names.get(`${side}Hand${digit}1`);
      objects[index].quaternion
        .multiply(new Quaternion().setFromAxisAngle(axes.x, sign * 0.07))
        .normalize();
      animated.add(index);
    }
  }
  update();
}
// Collect the union before recording; every clip writes the same channels,
// which allows reliable interruption / crossfade back to the natural stance.
for (const kind of ["idle", "cast", "hit"]) pose(kind, 0.2);
const bones = [...animated].sort((a, b) => a - b);
function append(values, type, min, max) {
  const bytes = Buffer.from(new Float32Array(values).buffer),
    padding = (4 - (byteLength % 4)) % 4;
  if (padding) {
    chunks.push(Buffer.alloc(padding));
    byteLength += padding;
  }
  const bufferView = gltf.bufferViews.length;
  gltf.bufferViews.push({
    buffer: 0,
    byteOffset: byteLength,
    byteLength: bytes.length,
  });
  chunks.push(bytes);
  byteLength += bytes.length;
  const accessor = {
    bufferView,
    componentType: 5126,
    count: values.length / { SCALAR: 1, VEC3: 3, VEC4: 4 }[type],
    type,
  };
  if (min) accessor.min = min;
  if (max) accessor.max = max;
  gltf.accessors.push(accessor);
  return gltf.accessors.length - 1;
}
gltf.animations = [];
const metrics = [];
const kneeAngle = (side) => {
  const hip = point(`${side}UpLeg`),
    knee = point(`${side}Leg`),
    ankle = point(`${side}Foot`);
  return (hip.sub(knee).angleTo(ankle.sub(knee)) * 180) / Math.PI;
};
for (const [name, duration] of [
  ["idle", 4.4],
  ["cast", 1.6],
  ["hit", 0.78],
]) {
  const samples = Math.ceil(duration * 30),
    times = [
      ...new Set(
        [
          ...Array.from(
            { length: samples + 1 },
            (_, i) => (duration * i) / samples,
          ),
          ...(name === "cast" ? castKeys : name === "hit" ? hitKeys : []).map(
            (k) => k.t,
          ),
        ].map((t) => Number(t.toFixed(6))),
      ),
    ].sort((a, b) => a - b);
  const data = bones.map(() => []),
    positions = [],
    measures = [];
  times.forEach((time) => {
    pose(name, time);
    positions.push(...bone("Hips").position.toArray());
    measures.push({
      time,
      knees: { left: kneeAngle("Left"), right: kneeAngle("Right") },
      waistHandError: point("LeftHand").distanceTo(
        waistBone.localToWorld(waistPoint.clone()),
      ),
      ...Object.fromEntries(
        ["Hips", "Head", "LeftHand", "RightHand"].map((n) => [
          n,
          point(n).toArray(),
        ]),
      ),
      footDrift: Math.max(
        ...feet.map((f) => point(`${f.side}Foot`).distanceTo(f.point)),
      ),
    });
    bones.forEach((bone, i) =>
      data[i].push(...objects[bone].quaternion.toArray()),
    );
  });
  const input = append(times, "SCALAR", [0], [duration]);
  const animation = { name, samplers: [], channels: [] };
  bones.forEach((node, i) => {
    const output = append(data[i], "VEC4");
    animation.samplers.push({ input, output, interpolation: "LINEAR" });
    animation.channels.push({ sampler: i, target: { node, path: "rotation" } });
  });
  animation.samplers.push({
    input,
    output: append(positions, "VEC3"),
    interpolation: "LINEAR",
  });
  animation.channels.push({
    sampler: animation.samplers.length - 1,
    target: { node: names.get("Hips"), path: "translation" },
  });
  animation.extras =
    name === "cast"
      ? {
          releaseAt: 0.55,
          phases: [
            { name: "backswing", start: 0, end: 0.12 },
            { name: "rising-arc", start: 0.12, end: 0.4 },
            { name: "palm-release", start: 0.4, end: 0.55 },
            { name: "follow-through", start: 0.55, end: 0.68 },
            { name: "settle", start: 0.68, end: 1.6 },
          ],
        }
      : { loop: name === "idle" };
  metrics.push({
    name,
    duration,
    footDriftMax: Math.max(...measures.map((m) => m.footDrift)),
    ranges: Object.fromEntries(
      ["Hips", "Head", "LeftHand", "RightHand"].map((n) => [
        n,
        [0, 1, 2].map(
          (axis) =>
            Math.max(...measures.map((m) => m[n][axis])) -
            Math.min(...measures.map((m) => m[n][axis])),
        ),
      ]),
    ),
    samples: measures,
  });
  gltf.animations.push(animation);
}
gltf.asset.extras = {
  ...gltf.asset.extras,
  emberfallAnimationSource: source,
  emberfallMotion: {
    author: "Emberfall original battle choreography",
    tool: "tools/animate-mage-hero.mjs",
    version: 3,
    castReleaseAt: 0.55,
    castDuration: 1.6,
    notes:
      "Original single-hand spell choreography. Upright planted stance, left hand locked to waist and right hand relaxed low; staggered breathing/wrist/head idle rhythms. Right arm sweeps from behind/below into a forward palm release at 0.55s. Hip, chest and wrist settle sequentially. Repaired robe weights preserved.",
  },
};
gltf.buffers = [{ byteLength }];
const j = Buffer.from(JSON.stringify(gltf)),
  json = Buffer.alloc(Math.ceil(j.length / 4) * 4, 32);
j.copy(json);
const b = Buffer.concat(chunks),
  bin = Buffer.alloc(Math.ceil(b.length / 4) * 4);
b.copy(bin);
const header = Buffer.alloc(12),
  jh = Buffer.alloc(8),
  bh = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
jh.writeUInt32LE(json.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
bh.writeUInt32LE(bin.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
await writeFile(output, Buffer.concat([header, jh, json, bh, bin]));
await writeFile(
  `${output}.motion.json`,
  JSON.stringify({ version: 3, metrics }, null, 2),
);
console.log(
  JSON.stringify({
    output,
    animatedBones: bones.length,
    clips: gltf.animations.map((clip) => clip.name),
    bytes: 28 + json.length + bin.length,
  }),
);
