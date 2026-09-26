/* EmberVoxelFx — the hit-feel effect stack for voxel figures, ported from Voxel Musou
 * (github.com/mike007jd/voxel-musou, src/vfx/vfx.js · MIT License, Copyright (c) 2026 BubuAi).
 * Sized for our figures (≈ 1 unit tall; their hero ≈ 1.85 m, so S = 0.54 scales every length, speed and
 * acceleration) and aged in sim frames (60 Hz), so a capture that renders any frame shows the same state as
 * real-time play.
 *  - ribbon : the weapon's slash arc — near-white core, blue fringe and a thin HDR rim over a veil of stepped
 *             speed lines; only a fast tip draws; premultiplied "over" blending so folds never add up to white
 *  - beams  : thrust streaks and light pillars (camera-facing, axial)
 *  - stars  : the contact burst (13 seeded spikes, white-hot root → orange → dark-red tip, gone in ≈ 8 frames)
 *             and the charge glint that rides the weapon tip
 *  - pools  : needle sparks, voxel debris clumps (bounce once, settle, sink), dust billows, embers, shards
 *  - rings  : ground shock fronts
 * `pixel: true` steps every sprite on a pixel grid (the voxel look); false keeps them smooth.
 * Drawn on a transparent overlay: additive layers add light without writing alpha (the page shows through
 * where they are dark), premultiplied layers composite "over" with correct alpha. */
const EmberVoxelFx = (() => {
  const THREE = EmberVesperThree;
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Color();
  const _up = new THREE.Vector3(0, 0, 1);
  const lin = (hex, k = 1) => { _c.set(hex); return [_c.r * k, _c.g * k, _c.b * k]; };
  // blend modes that stay correct over a transparent canvas composited on the page
  const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
  const OVER = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };

  // palettes (linear; > 1 = HDR, blooms)
  const NEEDLE_WARM = [[0.36, 0.07, 0.012], [0.4, 0.12, 0.02], [0.45, 0.2, 0.04], [1.6, 1.2, 0.6]];
  const NEEDLE_COOL = [[1.2, 1.9, 2.8], [1.7, 2.2, 2.8], [0.6, 1.4, 2.6]];
  const HOT_COOL = [[0.06, 0.2, 0.45], [0.1, 0.3, 0.55], [0.15, 0.4, 0.7], [1.2, 1.6, 2.0]];
  const FLASH_WARM = [0.38, 0.08, 0.015], BURST_COOL = [0.06, 0.2, 0.45], FLASH_COOL = [0.8, 1.5, 2.6];
  const GOLD = [1.5, 0.72, 0.2];
  const DUST = [lin(0xbb8965, 1.05), lin(0xc99a76, 1.0), lin(0xe8bd9d, 0.9), lin(0xa87a5c, 1.1)];
  const DUST_WALL = [...DUST, lin(0x8f7060), lin(0x76604f), lin(0x9a7a64)];
  const ROCK = [lin(0x5a5452), lin(0x6a6260), lin(0x7c7270), lin(0x8a807a), lin(0x4c4644)];

  // seeded visual RNG (mulberry32): effects are reproducible frame for frame
  function rng(seed) {
    let a = seed >>> 0;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { next, range: (lo, hi) => lo + (hi - lo) * next(), int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)), chance: (p) => next() < p, seed: (s) => { a = s >>> 0; } };
  }

  // ------------------------------------------------------------------ shaders
  const DUST_VS = /* glsl */ `
    attribute float aFade; uniform vec2 uNear; uniform float uPixK;
    varying vec3 vCol; varying float vA; varying vec2 vP; varying float vSteps; varying float vSeed;
    void main() {
      vec4 mvPosition = viewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
      float w = length(instanceMatrix[0].xyz);
      mvPosition.xy += position.xy * w;
      vP = position.xy; vCol = instanceColor;
      vA = aFade * smoothstep(uNear.x, uNear.y, -mvPosition.z);
      vSteps = clamp(w * 6.0 * uPixK, 6.0, 16.0);
      vSeed = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453) * 6.2832 + 2.0 * atan(instanceMatrix[0].z, instanceMatrix[0].x);
      gl_Position = projectionMatrix * mvPosition;
    }`;
  const DUST_FS = /* glsl */ `
    varying vec3 vCol; varying float vA; varying vec2 vP; varying float vSteps; varying float vSeed;
    void main() {
      #ifdef PIXEL
        vec2 p = floor(vP * vSteps + 0.5) / vSteps;
      #else
        vec2 p = vP;
      #endif
      float r = length(p), th = atan(p.y, p.x);
      float edge = 0.8 + 0.12 * sin(3.0 * th + vSeed) + 0.07 * sin(5.0 * th - 1.7 * vSeed);
      float a = vA * (1.0 - smoothstep(edge - 0.35, edge, r));
      if (a < 0.01) discard;
      vec2 q = p / edge;
      vec3 n = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))));
      float sh = 0.58 + 0.55 * max(0.0, dot(n, vec3(0.28, 0.82, 0.5)));
      gl_FragColor = vec4(vCol * sh, a);
    }`;

  // aT = (age 0 new..1 old, across 0 inner..1 outer edge, gain, hue 0 white-blue..1 teal); uS = world scale
  const TRAIL_VS = /* glsl */ `
    uniform vec3 uHeroA, uHeroB; uniform float uS;
    attribute vec4 aT; varying vec4 vT; varying float vNear; varying vec3 vView; varying float vVeil;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vT = aT; vView = mv.xyz;
      vNear = smoothstep(1.8 * uS, 4.4 * uS, -mv.z);
      // slide toward the camera along the view ray (same pixels, nearer depth) so the arc reads over what it cuts;
      // where the ray passes the attacker's body axis and the ribbon is behind him, it stops just behind it
      float d = length(mv.xyz);
      vec3 dir = mv.xyz / d, u = uHeroB - uHeroA;
      float b = dot(u, dir), e = dot(dir, uHeroA);
      float s = clamp((b * e - dot(u, uHeroA)) / max(dot(u, u) - b * b, 1e-6), 0.0, 1.0);
      vec3 q = uHeroA + u * s;
      float t = dot(q, dir), miss = length(q - dir * t);
      float P = 3.5 * uS;
      float pull = mix(clamp(d - t - 0.4 * uS, 0.0, P), P, max(step(d, t), smoothstep(0.45 * uS, 0.9 * uS, miss)));
      vVeil = (1.0 - 0.7 * (1.0 - smoothstep(0.3 * uS, 0.85 * uS, miss)) * step(d, t - 0.1 * uS)) * (0.45 + 0.55 * smoothstep(2.2 * uS, 5.5 * uS, d));
      mv.xyz *= max(0.3, (d - pull) / d);
      gl_Position = projectionMatrix * mv;
    }`;
  const TRAIL_FS = /* glsl */ `
    uniform float uEdge;
    varying vec4 vT; varying float vNear; varying vec3 vView; varying float vVeil;
    float h1(float n) { return fract(sin(n * 91.7) * 43758.5453); }
    void main() {
      float age = clamp(vT.x, 0.0, 1.0), v = clamp(vT.y, 0.0, 1.0), g = vT.z * vNear, hue = vT.w;
      vec3 nrm = cross(dFdx(vView), dFdy(vView));
      float facing = abs(dot(nrm, normalize(vView))) / max(length(nrm), 1e-20);
      float graze = 1.0 - smoothstep(0.25, 0.7, facing);
      float life = 1.0 - pow(age, 1.0 + 1.3 * graze);
      #ifdef PIXEL
        float band = floor(v * 14.0);
        float lq = floor(life * 6.0 + 0.999) / 6.0;
      #else
        float band = v * 14.0;
        float lq = life;
      #endif
      float vq = (floor(band) + 0.5) / 14.0;
      float r1 = h1(floor(band) * 1.7 + 3.0), r2 = h1(floor(band) * 3.1 + 11.0);
      float head = smoothstep(0.7, 1.0, life);
      vec3 white = mix(vec3(0.74, 0.84, 0.95), vec3(0.55, 0.9, 0.9), hue);
      vec3 blue = mix(vec3(0.12, 0.36, 1.0), vec3(0.02, 0.7, 0.85), hue);
      float rimLo = 12.5 - graze;
      vec4 o;
      if (uEdge > 0.5) {
        float coreLo = 8.5 - 2.0 * graze;
        float core = step(coreLo, band) * (1.0 - step(rimLo, band)) * smoothstep(0.25, 0.6, life);
        float fringe = step(coreLo - 1.0, band) * (1.0 - step(coreLo, band)) * step(0.4, life);
        float rim = step(rimLo, band) * step(age, 0.8) * pow(life, 0.5);
        float aC = core * mix(0.5, 0.4, graze) * (0.55 + 0.45 * head) * (0.8 + 0.2 * r1) * vVeil;
        vec3 hot = mix(vec3(1.3, 1.42, 1.55), vec3(1.05, 1.55, 1.5), hue);
        o = vec4(white * aC + blue * fringe * 0.5 * vVeil + hot * rim * (0.75 + 0.35 * head), aC + fringe * 0.4 * vVeil + rim) * g;
      } else {
        float alive = step(age, (0.3 + 0.6 * r2) * (0.4 + 0.6 * vq));
        float lines = step(mix(0.45, 0.15, graze), r1) * (0.4 + 0.6 * r1) * alive * lq * (1.0 - step(rimLo, band));
        float veil = pow(vq, 1.4) * lq * mix(0.12, 0.22, graze) * vVeil;
        float aL = lines * mix(0.26, 0.32, graze) * vVeil;
        o = vec4(white * (veil * 0.85 + aL * 1.1) + blue * veil * 0.12, veil + aL) * g;
      }
      if (o.a < 0.015) discard;
      gl_FragColor = o;
    }`;

  // axial billboard beam: instance z column = axis (with length), x column length = width, translation = start
  const BEAM_VS = /* glsl */ `
    attribute vec3 aF; uniform float uS; varying vec2 vUv; varying vec3 vF; varying vec3 vCol; varying float vNear;
    void main() {
      vec3 start = instanceMatrix[3].xyz, axis = instanceMatrix[2].xyz;
      float w = length(instanceMatrix[0].xyz);
      vec3 p = start + axis * position.y;
      vec3 side = cross(axis, cameraPosition - p);
      float sl = length(side);
      side = sl > 1e-5 ? side / sl : vec3(1.0, 0.0, 0.0);
      p += side * position.x * w * 0.5;
      vUv = vec2(position.x, position.y); vF = aF; vCol = instanceColor;
      vec4 mv = viewMatrix * vec4(p, 1.0);
      vNear = 0.3 + 0.7 * smoothstep(2.0 * uS, 5.0 * uS, -mv.z);
      gl_Position = projectionMatrix * mv;
    }`;
  const BEAM_FS = /* glsl */ `
    varying vec2 vUv; varying vec3 vF; varying vec3 vCol; varying float vNear;
    void main() {
      float u = vF.x, k = vF.z;
      #ifdef PIXEL
        float y = floor(vUv.y * 16.0 + 0.5) / 16.0;
      #else
        float y = vUv.y;
      #endif
      float x = abs(vUv.x);
      float along;
      if (k < 0.5) along = pow(y, 1.3) * (1.0 - smoothstep(0.93, 1.0, y) * 0.6);
      else if (k < 1.5) along = pow(1.0 - y, 0.8) * smoothstep(0.0, 0.08, y);
      else if (k < 2.5) along = pow(1.0 - y, 1.7) * smoothstep(0.0, 0.04, y);
      else along = smoothstep(0.0, 0.3, y) * pow(1.0 - y, 1.1);
      float c0 = k < 0.5 ? 0.12 : k < 1.5 ? 0.08 : 0.14, c1 = k < 0.5 ? 0.3 : k < 1.5 ? 0.26 : 0.42;
      float core = 1.0 - smoothstep(c0, c1, x);
      float glow = (1.0 - x) * (1.0 - x) * (k < 0.5 ? 0.45 : k < 1.5 ? 0.22 : 0.45);
      float gain = k < 0.5 ? 1.0 : k < 1.5 ? 0.6 : 0.75;
      float fade = (1.0 - u) * (1.0 - u);
      vec3 col = vCol * glow + mix(vCol, vec3(1.8, 1.95, 2.1), k > 1.5 ? 0.1 : 0.6) * core;
      gl_FragColor = vec4(col * along * fade * gain * vNear, 1.0);
    }`;

  // camera-facing star: aF.z = 1 contact burst (premultiplied over), 0 glint (additive)
  const STAR_VS = /* glsl */ `
    attribute vec3 aF; uniform float uS; varying vec2 vP; varying vec3 vF; varying vec3 vCol;
    void main() {
      vec4 mv = viewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
      float s = length(instanceMatrix[0].xyz);
      mv.xy += position.xy * s;
      mv.z += aF.z > 0.5 ? min(1.3 * uS, 0.8 * s) : min(0.7 * uS, s);   // never buried in a body
      vP = position.xy; vF = aF; vCol = instanceColor;
      gl_Position = projectionMatrix * mv;
    }`;
  const STAR_FS = /* glsl */ `
    varying vec2 vP; varying vec3 vF; varying vec3 vCol;
    float h1(float n) { return fract(sin(n * 91.7) * 43758.5453); }
    void main() {
      float u = vF.x, a = vF.y * 6.2832;
      if (vF.z > 0.5) {
        #ifdef PIXEL
          vec2 p = floor(vP * 18.0 + 0.5) / 18.0;
        #else
          vec2 p = vP;
        #endif
        float r = length(p), th = atan(p.y, p.x) + a;
        const float N = 13.0;
        float sec = floor(th / 6.2832 * N + 64.0);
        float ang = (sec + 0.5 + (h1(sec + vF.y * 7.0) - 0.5) * 0.5) / N * 6.2832;
        float dth = abs(mod(th - ang + 3.1416, 6.2832) - 3.1416);
        float len = mix(0.42, 1.0, h1(sec * 1.37 + vF.y * 13.0)) * (0.7 + 0.3 * min(1.0, u * 4.0));
        float rl = r / len;
        float w = 0.05 * (1.0 - rl) + 0.01;
        float spike = step(rl, 1.0) * step(r * dth, w) * step(0.55 * u * u + 0.06 * u, rl);
        float core = (1.0 - step(0.03 + 0.13 * (1.0 - u) * (1.0 - u), r)) * step(u, 0.4);
        float ball = max(0.0, 1.0 - r / (0.34 - 0.14 * u));
        float fade = 1.0 - u * u, fb = (1.0 - u) * (1.0 - u);
        vec3 hot = vec3(2.4, 2.2, 1.9), yel = vCol * vec3(1.1, 2.0, 2.0);
        vec3 sc = mix(mix(hot, yel, smoothstep(0.02, 0.14, rl)), vCol, smoothstep(0.14, 0.4, rl));
        sc = mix(sc, vCol * vec3(0.8, 0.6, 0.6), smoothstep(0.7, 1.0, rl));
        float aS = spike * fade * 0.9, aB = ball * fb * 0.45, aC = core * fb * fb;
        vec3 col = sc * aS + vCol * aB * (1.0 - aS) + hot * aC;
        float al = max(max(aS, aB), aC);
        if (al < 0.01) discard;
        gl_FragColor = vec4(col, al);
        return;
      }
      #ifdef PIXEL
        vec2 p = floor(vP * 12.0 + 0.5) / 12.0;
      #else
        vec2 p = vP;
      #endif
      vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
      vec2 d = vec2(q.x + q.y, q.x - q.y) * 0.7071;
      float r = length(p);
      float core = 1.0 - step(0.06 + 0.07 * (1.0 - u), r);
      float s1 = max(max(0.0, 1.0 - abs(q.x) * 14.0) * (1.0 - abs(q.y)), max(0.0, 1.0 - abs(q.y) * 14.0) * (1.0 - abs(q.x)));
      float s2 = max(max(0.0, 1.0 - abs(d.x) * 18.0) * max(0.0, 1.0 - abs(d.y) * 1.4), max(0.0, 1.0 - abs(d.y) * 18.0) * max(0.0, 1.0 - abs(d.x) * 1.4));
      float fade = (1.0 - u) * (1.0 - u);
      vec3 col = vCol * (s1 * 1.1 + s2 * 0.6) + vec3(2.2, 2.1, 2.0) * core;
      gl_FragColor = vec4(col * fade, 0.0);
    }`;

  const RING_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const RING_FS = /* glsl */ `
    uniform float uU; uniform vec3 uColor; varying vec2 vUv;
    void main() {
      #ifdef PIXEL
        float r = floor(length(vUv) * 40.0 + 0.5) / 40.0;
      #else
        float r = length(vUv);
      #endif
      float front = 0.3 + 0.7 * (1.0 - (1.0 - uU) * (1.0 - uU));
      float band = smoothstep(front - 0.14, front, r) * (1.0 - step(front, r));
      float edge = smoothstep(front - 0.04, front, r) * (1.0 - step(front, r));
      float fade = (1.0 - uU) * (1.0 - uU);
      gl_FragColor = vec4(uColor * (band * 0.22 + edge * 0.9) * fade, 1.0);
    }`;

  // voxel debris: flat-lit clumps in the scene's light (instanceColor × per-cube shade)
  const DEB_VS = /* glsl */ `
    attribute vec3 color; varying vec3 vN; varying vec3 vCol;
    void main() {
      mat4 m = modelMatrix * instanceMatrix;
      vN = normalize(mat3(m) * normal); vCol = instanceColor * color;
      gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
    }`;
  const DEB_FS = /* glsl */ `
    uniform vec3 uKeyDir, uKeyCol, uSky, uGround; varying vec3 vN; varying vec3 vCol;
    void main() {
      vec3 N = normalize(vN);
      vec3 c = vCol * (uKeyCol * max(dot(N, normalize(uKeyDir)), 0.0) + mix(uGround, uSky, N.y * 0.5 + 0.5));
      gl_FragColor = vec4(c, 1.0);
    }`;

  /** 2×2×2 clump with one corner knocked out and per-cube shade (reads as broken voxel matter) */
  function clumpGeometry() {
    const parts = [], shade = [1.0, 0.8, 0.93, 0.74, 1.06, 0.86, 0.96];
    let k = 0;
    for (const x of [-0.25, 0.25]) for (const y of [-0.25, 0.25]) for (const z of [-0.25, 0.25]) {
      if (x > 0 && y > 0 && z > 0) continue;
      const g = new THREE.BoxGeometry(0.5, 0.5, 0.5).translate(x, y, z), v = shade[k++];
      g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(v), 3));
      parts.push(g);
    }
    // merge by hand (no BufferGeometryUtils in the vendored build)
    const P = [], N = [], C = [], I = [];
    let off = 0;
    for (const g of parts) {
      P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); C.push(...g.attributes.color.array);
      for (const i of g.index.array) I.push(i + off);
      off += g.attributes.position.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.Float32BufferAttribute(P, 3)); out.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
    out.setAttribute("color", new THREE.Float32BufferAttribute(C, 3)); out.setIndex(I);
    return out;
  }
  function boxGeometry() {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3));
    return g;
  }

  function create(scene, opts = {}) {
    const S = opts.scale ?? 0.54, pixel = opts.pixel !== false, defs = pixel ? { PIXEL: 1 } : {};
    const L = opts.light;
    let frame = 0;
    const now = () => frame;
    const vr = rng(opts.seed ?? 7936);

    // ---------------------------------------------------------------- particle pools (instanced cubes)
    // kind: 0 needle spark, 1 debris (tumbles, bounces once, settles, sinks), 2 dust, 3 ember/mote, 4 glow shard
    function makePool(n, mat, { fade = false, geo = new THREE.BoxGeometry(1, 1, 1) } = {}) {
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
      scene.add(mesh);
      const F = () => new Float32Array(n);
      const p = { mesh, n, next: 0, x: F(), y: F(), z: F(), vx: F(), vy: F(), vz: F(), life: F(), max: F(), size: F(), kind: new Uint8Array(n), rot: F(), rv: F(), a: F(), last: F(), ax: F(), ay: F(), az: F() };
      let fadeAttr = null;
      if (fade) { fadeAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage); mesh.geometry.setAttribute("aFade", fadeAttr); }
      p.spawn = (x, y, z, vx, vy, vz, life, size, kind, r, g, b, alpha = 1) => {
        const i = p.next; p.next = (p.next + 1) % n;
        p.x[i] = x; p.y[i] = y; p.z[i] = z; p.vx[i] = vx; p.vy[i] = vy; p.vz[i] = vz;
        p.life[i] = life; p.max[i] = life; p.size[i] = size; p.kind[i] = kind; p.rot[i] = vr.range(0, 6.3);
        p.rv[i] = vr.range(-12, 12) * (kind === 1 ? Math.min(1, (0.16 * S) / size) : 1);   // big chunks tumble slowly (mass)
        const ax = vr.range(-1, 1), ay = vr.range(-1, 1), az = vr.range(-1, 1), al = Math.hypot(ax, ay, az) || 1;
        p.ax[i] = ax / al; p.ay[i] = ay / al; p.az[i] = az / al;
        p.a[i] = alpha; p.last[i] = now();
        mesh.setColorAt(i, _c.setRGB(r, g, b)); mesh.instanceColor.needsUpdate = true;
        return i;
      };
      function integrate(i, dt) {
        const k = p.kind[i];
        if (k === 5) return;                                   // scripted (assembling voxels)
        if (k === 0) { p.vy[i] -= 9 * S * dt; const f = 1 - 7 * dt; p.vx[i] *= f; p.vy[i] *= f; p.vz[i] *= f; }
        else if (k === 1) {
          p.vy[i] -= 22 * S * dt;
          const h = p.size[i] * 0.5;
          if (p.y[i] < h) {
            p.y[i] = h;
            if (p.vy[i] < -1.5 * S) { p.vy[i] *= -0.32; p.vx[i] *= 0.55; p.vz[i] *= 0.55; p.rv[i] *= 0.5; }
            else { p.vy[i] = 0; const f = 1 - 8 * dt; p.vx[i] *= f; p.vz[i] *= f; p.rv[i] *= f; }
          }
        } else if (k === 2) { const f = 1 - 2.6 * dt; p.vx[i] *= f; p.vz[i] *= f; p.vy[i] *= 1 - 1.8 * dt; }
        else if (k === 3) { p.vx[i] += (0.7 + Math.sin(p.life[i] * 2.3 + i) * 0.9) * S * dt; p.vz[i] += Math.cos(p.life[i] * 1.7 + i) * 0.6 * S * dt; p.vy[i] *= 1 - 0.3 * dt; }
        else { p.vy[i] -= 6 * S * dt; const f = 1 - 2.5 * dt; p.vx[i] *= f; p.vz[i] *= f; }
        p.x[i] += p.vx[i] * dt; p.y[i] += p.vy[i] * dt; p.z[i] += p.vz[i] * dt;
        p.rot[i] += p.rv[i] * dt;
      }
      p.clear = () => { p.life.fill(0); for (let i = 0; i < n; i++) mesh.setMatrixAt(i, ZERO); mesh.instanceMatrix.needsUpdate = true; p.next = 0; };
      p.update = () => {
        const f = now();
        let hi = -1;
        for (let i = 0; i < n; i++) {
          if (p.life[i] <= 0) continue;
          const dtAll = Math.max(0, (f - p.last[i]) / 60);
          p.last[i] = f;
          if (p.life[i] <= dtAll) { p.life[i] = 0; mesh.setMatrixAt(i, ZERO); continue; }
          hi = i;
          if (dtAll > 0) {
            const sub = Math.ceil(dtAll / (1 / 30)), dt = dtAll / sub;
            for (let k = 0; k < sub; k++) integrate(i, dt);
            p.life[i] -= dtAll;
          }
          const k = p.kind[i], u = p.life[i] / p.max[i];
          _p.set(p.x[i], p.y[i], p.z[i]);
          if (k === 0) {
            _d.set(p.vx[i], p.vy[i], p.vz[i]);
            const sp = _d.length();
            _q.setFromUnitVectors(_up, sp > 1e-4 ? _d.multiplyScalar(1 / sp) : _d.set(0, 1, 0));
            const w = p.size[i] * (0.35 + 0.65 * u);
            _s.set(w, w, Math.max(w, sp * 0.065 * p.a[i]));
          } else if (k === 2) {
            _q.setFromAxisAngle(_d.set(0, 1, 0), p.rot[i] * 0.15);
            const w = p.size[i] * (0.6 + (1 - u) * 0.9);
            _s.set(w, w * 0.8, w);
            if (fadeAttr) fadeAttr.array[i] = 0.8 * p.a[i] * Math.min(1, u * 1.4) * Math.min(1, (1 - u) * 12 + 0.25);
          } else if (k === 3) {
            _q.setFromAxisAngle(_d.set(0.6, 1, 0.3).normalize(), p.rot[i]);
            const w = p.size[i] * Math.min(1, u * 3) * (0.65 + 0.35 * Math.sin(p.life[i] * 23 + i));
            _s.set(w, w, w);
          } else {
            _q.setFromAxisAngle(_d.set(p.ax[i], p.ay[i], p.az[i]), p.rot[i]);
            const w = p.size[i] * (k === 1 ? Math.min(1, u * 6) : k === 5 ? 1 : u);
            _s.set(w, w, w);
            if (k === 1 && u < 1 / 6) _p.y -= (1 - u * 6) * p.size[i] * 0.5;   // sink into the ground as it goes
          }
          mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        }
        mesh.count = hi + 1;
        mesh.instanceMatrix.needsUpdate = true;
        if (fadeAttr) fadeAttr.needsUpdate = true;
      };
      return p;
    }
    function makeQuadPool(n, geo, vs, fs, premul) {
      const aF = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute("aF", aF);
      const mat = new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, defines: defs, uniforms: { uS: { value: S } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        ...(premul ? OVER : ADD) });
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false; mesh.renderOrder = 8;
      for (let i = 0; i < n; i++) { mesh.setMatrixAt(i, ZERO); mesh.setColorAt(i, _c.setRGB(1, 1, 1)); }
      scene.add(mesh);
      return { mesh, aF, n, next: 0 };
    }

    const hot = makePool(500, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false }));
    const sparks = makePool(900, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, ...ADD }));
    const debMat = new THREE.ShaderMaterial({ vertexShader: DEB_VS, fragmentShader: DEB_FS, uniforms: {
      uKeyDir: { value: new THREE.Vector3(...L.key) }, uKeyCol: { value: new THREE.Color(L.keyCol).multiplyScalar(L.keyI) },
      uSky: { value: new THREE.Color(L.sky).multiplyScalar(L.skyI) }, uGround: { value: new THREE.Color(L.ground).multiplyScalar(L.groundI) } } });
    const shard = () => { const g = new THREE.TetrahedronGeometry(0.62); g.setAttribute("color", new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3)); return g; };
    const debris = makePool(2200, debMat, { geo: pixel ? clumpGeometry() : shard() });
    const cubes = makePool(2600, debMat, { geo: pixel ? boxGeometry() : shard() });     // single voxels (shatter, assemble)
    const dust = makePool(600, new THREE.ShaderMaterial({ vertexShader: DUST_VS, fragmentShader: DUST_FS, defines: defs, transparent: true, depthWrite: false,
      uniforms: { uNear: { value: new THREE.Vector2(2.0 * S, 4.5 * S) }, uPixK: { value: 1 / S } } }), { fade: true, geo: new THREE.PlaneGeometry(2, 2) });
    dust.mesh.renderOrder = 6;

    // ---------------------------------------------------------------- rings
    const rings = [];
    const ringGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({ vertexShader: RING_VS, fragmentShader: RING_FS, defines: defs,
        uniforms: { uU: { value: 0 }, uColor: { value: new THREE.Color() } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, ...ADD }));
      m.visible = false; m.frustumCulled = false; m.userData = { f0: 0, dur: 0.4 }; m.renderOrder = 5;
      scene.add(m); rings.push(m);
    }
    let ringNext = 0;
    const ring = (x, z, r, dur, rgb, y = 0.006) => {
      const m = rings[ringNext]; ringNext = (ringNext + 1) % rings.length;
      m.position.set(x, y, z); m.userData = { f0: now(), dur }; m.visible = true; m.scale.setScalar(r);
      m.material.uniforms.uColor.value.setRGB(rgb[0], rgb[1], rgb[2]); m.material.uniforms.uU.value = 0;
    };

    // ---------------------------------------------------------------- beams
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 1, 1, 0, -1, 1, 0], 3));
    beamGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const beams = makeQuadPool(96, beamGeo, BEAM_VS, BEAM_FS, false);
    const BN = beams.n, B = { sx: new Float32Array(BN), sy: new Float32Array(BN), sz: new Float32Array(BN), dx: new Float32Array(BN), dy: new Float32Array(BN), dz: new Float32Array(BN),
      len: new Float32Array(BN), wid: new Float32Array(BN), t: new Float32Array(BN), dur: new Float32Array(BN), kind: new Uint8Array(BN), on: new Uint8Array(BN) };
    const STREAK = 0, RAY = 1, PILLAR = 2, SHAFT = 3;
    const beam = (kind, sx, sy, sz, dx, dy, dz, len, wid, dur, rgb, delay = 0) => {
      const i = beams.next; beams.next = (beams.next + 1) % BN;
      const l = Math.hypot(dx, dy, dz) || 1;
      B.sx[i] = sx; B.sy[i] = sy; B.sz[i] = sz; B.dx[i] = dx / l; B.dy[i] = dy / l; B.dz[i] = dz / l;
      B.len[i] = len; B.wid[i] = wid; B.t[i] = now() + delay * 60; B.dur[i] = dur; B.kind[i] = kind; B.on[i] = 1;
      beams.aF.array[i * 3 + 1] = vr.next(); beams.aF.array[i * 3 + 2] = kind;
      beams.mesh.setColorAt(i, _c.setRGB(rgb[0], rgb[1], rgb[2])); beams.mesh.instanceColor.needsUpdate = true;
    };
    const _ax = new THREE.Vector3(), _sd = new THREE.Vector3(), _st = new THREE.Vector3();
    const updateBeams = () => {
      const e = beams.mesh.instanceMatrix.array, f = now();
      for (let i = 0; i < BN; i++) {
        if (!B.on[i]) continue;
        const u = (f - B.t[i]) / 60 / B.dur[i];
        if (u >= 1) { B.on[i] = 0; beams.mesh.setMatrixAt(i, ZERO); continue; }
        if (u < 0) { beams.mesh.setMatrixAt(i, ZERO); continue; }
        let a0 = 0, a1 = 1, w = B.wid[i];
        if (B.kind[i] === STREAK) {
          a1 = 0.25 + 0.75 * Math.min(1, 1 - (1 - Math.min(1, u / 0.3)) ** 3);
          a0 = Math.max(0, (u - 0.3) / 0.7) ** 1.3 * 0.85;
          w *= 1 - 0.5 * u;
        } else {
          a1 = Math.min(1, 1 - (1 - Math.min(1, u / 0.22)) ** 3);
          w *= B.kind[i] >= PILLAR ? 0.7 + 0.5 * Math.min(1, u * 4) - 0.4 * u : 1 - 0.7 * u;
        }
        const Ln = B.len[i];
        _ax.set(B.dx[i], B.dy[i], B.dz[i]);
        _st.set(B.sx[i], B.sy[i], B.sz[i]).addScaledVector(_ax, Ln * a0);
        _ax.multiplyScalar(Ln * Math.max(0.01, a1 - a0));
        _sd.set(0, 1, 0).cross(_ax); if (_sd.lengthSq() < 1e-8) _sd.set(1, 0, 0); _sd.setLength(w);
        const o = i * 16;
        e[o] = _sd.x; e[o + 1] = _sd.y; e[o + 2] = _sd.z; e[o + 3] = 0;
        e[o + 4] = 0; e[o + 5] = 0; e[o + 6] = 0; e[o + 7] = 0;
        e[o + 8] = _ax.x; e[o + 9] = _ax.y; e[o + 10] = _ax.z; e[o + 11] = 0;
        e[o + 12] = _st.x; e[o + 13] = _st.y; e[o + 14] = _st.z; e[o + 15] = 1;
        beams.aF.array[i * 3] = u;
      }
      beams.mesh.instanceMatrix.needsUpdate = true; beams.aF.needsUpdate = true;
    };

    // ---------------------------------------------------------------- stars (slot 0 = the glint riding the tip)
    const stars = makeQuadPool(48, new THREE.PlaneGeometry(2, 2), STAR_VS, STAR_FS, true);
    stars.mesh.renderOrder = 12;
    const SN = stars.n, St = { x: new Float32Array(SN), y: new Float32Array(SN), z: new Float32Array(SN), size: new Float32Array(SN), t: new Float32Array(SN), dur: new Float32Array(SN), on: new Uint8Array(SN) };
    stars.next = 1;
    const tipNow = new THREE.Vector3();
    const star = (x, y, z, size, dur, rgb, slot = -1, burst = 0) => {
      const i = slot >= 0 ? slot : stars.next;
      if (slot < 0) stars.next = stars.next + 1 >= SN ? 1 : stars.next + 1;
      St.x[i] = x; St.y[i] = y; St.z[i] = z; St.size[i] = size; St.t[i] = now(); St.dur[i] = dur; St.on[i] = 1;
      stars.aF.array[i * 3 + 1] = vr.next(); stars.aF.array[i * 3 + 2] = burst;
      stars.mesh.setColorAt(i, _c.setRGB(rgb[0], rgb[1], rgb[2])); stars.mesh.instanceColor.needsUpdate = true;
    };
    const updateStars = () => {
      const f = now();
      for (let i = 0; i < SN; i++) {
        if (!St.on[i]) continue;
        const u = (f - St.t[i]) / 60 / St.dur[i];
        if (u >= 1) { St.on[i] = 0; stars.mesh.setMatrixAt(i, ZERO); continue; }
        if (i === 0) { St.x[0] = tipNow.x; St.y[0] = tipNow.y; St.z[0] = tipNow.z; }
        const s = St.size[i] * (i === 0 ? 0.6 + 0.4 * Math.sin(u * Math.PI) : stars.aF.array[i * 3 + 2] ? Math.min(1, 0.8 + u * 3) : Math.min(1, 0.45 + u * 4) * (1 - 0.3 * u));
        stars.mesh.setMatrixAt(i, _m.compose(_p.set(St.x[i], St.y[i], St.z[i]), _q.identity(), _s.set(s, s, s)));
        stars.aF.array[i * 3] = i === 0 ? u * 0.6 : u;
      }
      stars.mesh.instanceMatrix.needsUpdate = true; stars.aF.needsUpdate = true;
    };

    // ---------------------------------------------------------------- slash ribbon
    const LIFE = 8, SUB = 4, MAXS = 56, MAXV = MAXS * SUB * 2 + 16;
    const tgeo = new THREE.BufferGeometry();
    const tpos = new Float32Array(MAXV * 3), tat = new Float32Array(MAXV * 4);
    tgeo.setAttribute("position", new THREE.BufferAttribute(tpos, 3).setUsage(THREE.DynamicDrawUsage));
    tgeo.setAttribute("aT", new THREE.BufferAttribute(tat, 4).setUsage(THREE.DynamicDrawUsage));
    const tidx = [];
    for (let i = 0; i < MAXV / 2 - 1; i++) { const a = i * 2; tidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tgeo.setIndex(tidx);
    const heroA = { value: new THREE.Vector3(0, -1, -5) }, heroB = { value: new THREE.Vector3(0, 1, -5) };
    let heroFeet = new THREE.Vector3(), heroHead = new THREE.Vector3(0, 1, 0);
    for (const edge of [0, 1]) {
      const m = new THREE.Mesh(tgeo, new THREE.ShaderMaterial({ vertexShader: TRAIL_VS, fragmentShader: TRAIL_FS, defines: defs,
        uniforms: { uEdge: { value: edge }, uHeroA: heroA, uHeroB: heroB, uS: { value: S } }, transparent: true, depthWrite: false,
        side: THREE.DoubleSide, ...OVER }));
      m.frustumCulled = false; m.renderOrder = edge ? 10 : 7;
      if (!edge) m.onBeforeRender = (r, sc, cam) => {
        heroA.value.copy(heroFeet).applyMatrix4(cam.matrixWorldInverse);
        heroB.value.copy(heroHead).applyMatrix4(cam.matrixWorldInverse);
      };
      scene.add(m);
    }
    const samples = [];
    let clock = 0;
    const cr = (p0, p1, p2, p3, u, out) => {
      const u2 = u * u, u3 = u2 * u;
      return out.set(
        0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3),
        0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3),
        0.5 * (2 * p1.z + (-p0.z + p2.z) * u + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * u2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * u3));
    };
    const vb = new THREE.Vector3(), vt = new THREE.Vector3(), _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();
    /** one sim step of the ribbon: base/tip = weapon points this frame; on = inside a trail window */
    function trailStep(on, base, tip, heavy = false, hue = 0, hitstop = 0) {
      if (hitstop === 0 || hitstop % 2 === 0) clock++;          // half-rate ageing in hitstop: a heavy hit must not hang the crescent
      if (!on) { if (samples.length && !samples[samples.length - 1].brk) samples.push({ brk: true, c: clock }); return; }
      const s = samples.length > MAXS ? samples.shift() : null;
      const smp = s && !s.brk ? s : { b: new THREE.Vector3(), t: new THREE.Vector3(), rt: new THREE.Vector3() };
      smp.rt.copy(tip); smp.c = clock; smp.brk = false; smp.g = heavy ? 1.15 : 1; smp.hue = hue;
      const last = samples[samples.length - 1], prev = last && !last.brk ? last : null;
      if (prev && prev.rt.distanceToSquared(tip) < 1e-8) { prev.c = clock; return; }
      // only a fast tip leaves a ribbon: wind-ups and holds draw nothing
      smp.g *= THREE.MathUtils.smoothstep(prev ? prev.rt.distanceTo(tip) : 0, 0.08 * S, 0.3 * S);
      let flat = prev ? prev.flat : 0;
      if (prev) {
        _t1.subVectors(tip, prev.rt).cross(_t2.subVectors(tip, base));
        const l = _t1.length();
        if (l > 1e-6) flat = prev.flat * 0.4 + 0.6 * Math.abs(_t1.y) / l;
      }
      smp.flat = flat;
      const k = smp.fk = THREE.MathUtils.smoothstep(flat, 0.55, 0.85);
      _t2.subVectors(tip, base).normalize();
      smp.t.copy(tip).addScaledVector(_t2, 1.2 * S * k); smp.b.copy(base).addScaledVector(_t2, -0.45 * S * k);
      samples.push(smp);
    }
    function buildTrail() {
      while (samples.length && clock - samples[0].c > LIFE) samples.shift();
      let v = 0;
      const put = (b, t, age, g, hue, dead = false, fk = 0) => {
        if (v >= MAXV - 1) return;
        const a = Math.min(1, Math.max(0, age / LIFE));
        const k = 0.82 * a ** 1.25 * (1 - 0.75 * fk);             // crescent: the inner edge closes onto the tip path toward the tail
        let o = v * 3, q = v * 4;
        tpos[o] = b.x + (t.x - b.x) * k; tpos[o + 1] = b.y + (t.y - b.y) * k; tpos[o + 2] = b.z + (t.z - b.z) * k;
        tat[q] = dead ? 1 : a; tat[q + 1] = 0; tat[q + 2] = dead ? 0 : g; tat[q + 3] = hue;
        v++; o += 3; q += 4;
        tpos[o] = t.x; tpos[o + 1] = t.y; tpos[o + 2] = t.z;
        tat[q] = dead ? 1 : a; tat[q + 1] = 1; tat[q + 2] = dead ? 0 : g; tat[q + 3] = hue;
        v++;
      };
      let run = [], runs = 0, nRuns = 0;
      for (let i = 0; i < samples.length; i++) if (!samples[i].brk && (i === 0 || samples[i - 1].brk)) nRuns++;
      const emitRun = () => {
        const dim = ++runs < nRuns ? 0.4 : 1;
        if (run.length >= 2) {
          put(run[0].b, run[0].t, LIFE, 0, 0, true);
          for (let i = 0; i < run.length - 1; i++) {
            const p0 = run[Math.max(0, i - 1)], p1 = run[i], p2 = run[i + 1], p3 = run[Math.min(run.length - 1, i + 2)];
            for (let j = 0; j < SUB; j++) {
              const u = j / SUB;
              cr(p0.b, p1.b, p2.b, p3.b, u, vb); cr(p0.t, p1.t, p2.t, p3.t, u, vt);
              put(vb, vt, clock - (p1.c + (p2.c - p1.c) * u), p1.g * dim, p1.hue, false, p1.fk);
            }
          }
          const l = run[run.length - 1];
          put(l.b, l.t, clock - l.c, l.g * dim, l.hue, false, l.fk); put(l.b, l.t, LIFE, 0, 0, true);
        }
        run = [];
      };
      for (const s of samples) { if (s.brk) { if (run.length) emitRun(); } else run.push(s); }
      if (run.length) emitRun();
      tgeo.setDrawRange(0, Math.max(0, (v / 2 - 1) * 6));
      tgeo.attributes.position.needsUpdate = true; tgeo.attributes.aT.needsUpdate = true;
    }

    // ---------------------------------------------------------------- emitters (sizes in our units)
    const fx = { flash: 0, S, pixel };
    let flashHold = 0, flashDecay = 2.2;
    fx.flashAt = (v, hold = 0, decay = 2.2) => { if (v >= fx.flash) { fx.flash = v; flashHold = hold; flashDecay = decay; } };
    fx.needleBurst = (x, y, z, n, dx, dz, spd, pal, size = 0.045 * S, len = 1, pool = sparks) => {
      for (let i = 0; i < n; i++) {
        const a = vr.range(0, 6.283), up = vr.range(-0.35, 1), s = spd * vr.range(0.55, 1), c = pal[vr.int(0, pal.length - 1)];
        pool.spawn(x, y, z, (Math.cos(a) * 0.8 + dx * 0.7) * s, up * s * 0.75 + S, (Math.sin(a) * 0.8 + dz * 0.7) * s, vr.range(0.11, 0.2), size * vr.range(0.8, 1.2), 0, c[0], c[1], c[2], len);
      }
    };
    fx.dustPuff = (x, z, n, spread, size = 0.5 * S, y = 0.15 * S, alpha = 0.5) => {
      size *= 0.6;
      for (let i = 0; i < n * 2; i++) {
        const a = vr.range(0, 6.283), s = vr.range(0.4, 1) * spread, c = DUST[vr.int(0, DUST.length - 1)];
        dust.spawn(x + Math.cos(a) * 0.25 * S, y + vr.range(0, 0.25 * S), z + Math.sin(a) * 0.25 * S, Math.cos(a) * s, vr.range(0.3, 1.3) * S, Math.sin(a) * s,
          vr.range(0.6, 1.2), size * vr.range(0.7, 1.3), 2, c[0], c[1], c[2], alpha * vr.range(0.7, 1));
      }
    };
    fx.dustRing = (x, z, n, r0, spd, size, alpha = 0.55) => {
      size *= 0.6; n *= 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + vr.range(-0.15, 0.15), c = DUST[vr.int(0, DUST.length - 1)], s = spd * vr.range(0.75, 1.1);
        dust.spawn(x + Math.cos(a) * r0, (0.15 + vr.range(0, 0.3)) * S, z + Math.sin(a) * r0, Math.cos(a) * s, vr.range(0.4, 1.6) * S, Math.sin(a) * s,
          vr.range(0.7, 1.3), size * vr.range(0.7, 1.3), 2, c[0], c[1], c[2], alpha * vr.range(0.7, 1));
      }
    };
    fx.dustColumn = (x, z, n, r0, r1, top, size = [0.9 * S, 1.3 * S], alpha = 0.6) => {
      for (let i = 0; i < n; i++) {
        const a = vr.range(0, 6.283), d = vr.range(r0, r1), c = DUST_WALL[vr.int(0, DUST_WALL.length - 1)], k = vr.range(0.3, 1);
        dust.spawn(x + Math.cos(a) * d, 0.3 * S + (top * 0.62 - 0.3 * S) * k * k, z + Math.sin(a) * d, Math.cos(a) * vr.range(0.8, 2.6) * S, vr.range(1.4, 3.2) * top / 4.6, Math.sin(a) * vr.range(0.8, 2.6) * S,
          vr.range(1.0, 1.5), vr.range(size[0], size[1]), 2, c[0], c[1], c[2], alpha * vr.range(0.8, 1));
      }
    };
    // chunks fly away from the camera side (a chunk heading at the lens flies behind the victim instead)
    const camPos = new THREE.Vector3(0, 10, 10);
    fx.setCamera = (p) => camPos.copy(p);
    fx.chunks = (x, y, z, n, dx, dz, spd, pal, smin = 0.08 * S, smax = 0.18 * S, up = [2 * S, 4.5 * S], life = [1.4, 2.2]) => {
      const cx = camPos.x - x, cz = camPos.z - z, cl = Math.hypot(cx, cz) || 1, ux = cx / cl, uz = cz / cl;
      for (let i = 0; i < n; i++) {
        const c = pal[vr.int(0, pal.length - 1)], a = vr.range(0, 6.283), s = spd * vr.range(0.3, 1);
        let vx = (Math.cos(a) * 0.6 + dx) * s, vz = (Math.sin(a) * 0.6 + dz) * s;
        const tc = vx * ux + vz * uz;
        if (tc > 0) { vx -= 1.6 * tc * ux; vz -= 1.6 * tc * uz; }
        debris.spawn(x + vr.range(-0.2, 0.2) * S, y + vr.range(-0.4, 0.4) * S, z + vr.range(-0.2, 0.2) * S, vx, vr.range(up[0], up[1]), vz, vr.range(life[0], life[1]), vr.range(smin, smax), 1, c[0], c[1], c[2]);
      }
    };
    fx.rocks = (x, z, n, r, smin, smax, up, spd) => {
      for (let i = 0; i < n; i++) {
        const a = vr.range(0, 6.283), d = r * Math.sqrt(vr.range(0.04, 1)), s = spd * vr.range(0.35, 1), sz = vr.range(smin, smax), c = ROCK[vr.int(0, ROCK.length - 1)];
        debris.spawn(x + Math.cos(a) * d, sz * 0.5 + 0.03 * S, z + Math.sin(a) * d, Math.cos(a) * s, vr.range(up[0], up[1]), Math.sin(a) * s, vr.range(1.6, 2.4), sz, 1, c[0], c[1], c[2]);
      }
    };
    fx.shards = (x, y, z, n, spd, rgb, size = 0.08 * S) => {
      for (let i = 0; i < n; i++) {
        const a = vr.range(0, 6.283), s = spd * vr.range(0.4, 1);
        sparks.spawn(x, y, z, Math.cos(a) * s, vr.range(2, 8) * S, Math.sin(a) * s, vr.range(0.35, 0.7), size * vr.range(0.6, 1.3), 4, rgb[0] * vr.range(0.7, 1.1), rgb[1] * vr.range(0.8, 1.1), rgb[2]);
      }
    };
    fx.embers = (x, y, z, n, spread, rgb = [2.4, 0.95, 0.28]) => {
      for (let i = 0; i < n; i++) sparks.spawn(x + vr.range(-spread, spread), y + vr.range(0, 0.6 * S), z + vr.range(-spread, spread), vr.range(-1.2, 1.2) * S, vr.range(1.2, 3.5) * S, vr.range(-1.2, 1.2) * S, vr.range(0.9, 2.0), vr.range(0.03, 0.06) * S, 3, rgb[0], rgb[1], rgb[2]);
    };
    fx.ember = (x, y, z) => sparks.spawn(x, y, z, vr.range(-0.2, 0.6) * S, vr.range(0.3, 1.1) * S, vr.range(-0.3, 0.3) * S, vr.range(2.2, 4), vr.range(0.028, 0.05) * S, 3, 2.3, 0.85, 0.22);
    fx.star = star; fx.beam = beam; fx.ring = ring;
    fx.KIND = { STREAK, RAY, PILLAR, SHAFT };
    fx.PAL = { NEEDLE_WARM, NEEDLE_COOL, HOT_COOL, FLASH_WARM, BURST_COOL, FLASH_COOL, GOLD, DUST, ROCK };
    fx.rng = vr;
    /** a figure's own voxels become debris: centres/colours in world space (optional subset), flung from `from` */
    fx.shatter = (pts, cols, from, dir, { n = 600, spd = 2.2 * S, up = [1.2 * S, 3.6 * S], size = 0.015, life = [1.2, 1.8] } = {}) => {
      const cnt = pts.length / 3, step = Math.max(1, cnt / n);
      for (let f = 0; f < cnt; f += step) {
        const i = Math.floor(f), x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
        const ox = x - from.x, oy = y - from.y, oz = z - from.z, ol = Math.hypot(ox, oy, oz) || 1;
        const s = spd * vr.range(0.4, 1.1);
        const big = vr.chance(0.18);
        (big ? debris : cubes).spawn(x, y, z, (ox / ol * 0.8 + dir.x * 0.7) * s, vr.range(up[0], up[1]) + oy / ol * s * 0.4, (oz / ol * 0.8 + dir.z * 0.7) * s,
          vr.range(life[0], life[1]), size * (big ? vr.range(1.6, 2.6) : vr.range(0.9, 1.2)), 1, cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2]);
      }
    };
    /** debris that flies back in: assemble a figure from the ground (inverse of shatter), for respawns */
    const assembling = [];
    fx.assemble = (pts, cols, f0, dur, { n = 500, size = 0.015 } = {}) => {
      const cnt = pts.length / 3, step = Math.max(1, cnt / n);
      for (let f = 0; f < cnt; f += step) {
        const i = Math.floor(f), a = vr.range(0, 6.283), r = vr.range(0.1, 0.45);
        const j = cubes.spawn(pts[i * 3] + Math.cos(a) * r, 0.01, pts[i * 3 + 2] + Math.sin(a) * r, 0, 0, 0, dur / 60 + 0.05, size, 5, cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2]);
        assembling.push({ j, f0: f0 + vr.range(0, dur * 0.35), dur: dur * vr.range(0.55, 0.65), sx: cubes.x[j], sy: cubes.y[j], sz: cubes.z[j], tx: pts[i * 3], ty: pts[i * 3 + 1], tz: pts[i * 3 + 2] });
      }
    };
    fx.setTip = (p) => tipNow.copy(p);
    fx.setHero = (feet, head) => { heroFeet.copy(feet); heroHead.copy(head); };
    fx.trailStep = trailStep;

    fx.step = (f) => {                                       // advance to sim frame f (called once per frame, in order)
      frame = f;
      // assembling voxels ride a hop from the ground into place (kind 5 = scripted, no physics)
      for (let k = assembling.length - 1; k >= 0; k--) {
        const A = assembling[k], u = Math.min(1, Math.max(0, (f - A.f0) / A.dur)), e = 1 - (1 - u) ** 3;
        cubes.x[A.j] = A.sx + (A.tx - A.sx) * e; cubes.z[A.j] = A.sz + (A.tz - A.sz) * e;
        cubes.y[A.j] = A.sy + (A.ty - A.sy) * e + Math.sin(u * Math.PI) * 0.12;
        cubes.vx[A.j] = cubes.vy[A.j] = cubes.vz[A.j] = 0; cubes.rot[A.j] = (1 - e) * 6;
        if (u >= 1) assembling.splice(k, 1);
      }
    };
    fx.update = (dt) => {                                    // after step(): rebuild instance data for rendering
      sparks.update(); hot.update(); debris.update(); dust.update(); cubes.update();
      updateBeams(); updateStars();
      for (const r of rings) {
        if (!r.visible) continue;
        const u = (now() - r.userData.f0) / 60 / r.userData.dur;
        if (u >= 1) { r.visible = false; continue; }
        r.material.uniforms.uU.value = u;
      }
      if (flashHold > 0) flashHold -= dt;
      else fx.flash = Math.max(0, fx.flash - dt * flashDecay);
      buildTrail();
    };
    fx.reset = () => {
      frame = 0; vr.seed(opts.seed ?? 7936);
      sparks.clear(); hot.clear(); debris.clear(); dust.clear(); cubes.clear(); samples.length = 0; clock = 0; assembling.length = 0;
      for (const r of rings) r.visible = false;
      B.on.fill(0); St.on.fill(0); fx.flash = 0; flashHold = 0;
      for (const q of [beams, stars]) { for (let i = 0; i < q.n; i++) q.mesh.setMatrixAt(i, ZERO); q.mesh.instanceMatrix.needsUpdate = true; }
      beams.next = 0; stars.next = 1;
    };
    fx.pools = { sparks, hot, debris, dust, cubes };
    return fx;
  }

  return { create };
})();
