/* EmberSpriteFigures — painted pixel-art figures on the battlefield (docs/design/MINIATURES.md). A figure whose art
 * is in EmberSpriteArt stands as a flat sprite instead of its sculpted 3D figure: a quad that always faces the camera,
 * drawn at full resolution over the 3D figures' pixel pass (camera layer LAYER), its texels kept square at any scale
 * (sharp-bilinear sampling). It keeps its 3D figure's spec (size, moves) and plugs into EmberVoxelRender /
 * EmberVoxelClips, so the arena stations, cues and shatters it like any other figure:
 *   · faces: it mirrors toward the way its figure turns (left or right on screen); art is painted facing `faces`
 *   · idle breathes (a hovering figure bobs), attack coils back, snaps forward and recovers on the director's
 *     timeline, hurt is knocked back and shakes, victory hops; the hit glow washes its pixels
 *   · assembles and shatters from its own opaque pixels
 * `?sprites=0` keeps the sculpted figures (for comparison). */
const EmberSpriteFigures = (() => {
  const THREE = EmberVesperThree, R = EmberVoxelRender, C = EmberVoxelClips;
  const LAYER = 1;
  const PX = 1 / 120;              // world units per sprite pixel (before the station fit)
  // faces: the way the art looks on screen (+1 right, −1 left); hover: height a flier floats at (world units)
  const DEF = { paladin: { faces: -1 }, wisp: { faces: -1, hover: 0.08 }, wolf: { faces: 1 } };
  const on = typeof location === "undefined" || new URLSearchParams(location.search).get("sprites") !== "0";
  const sheets = new Map();        // id → { tex, w, h, data }
  const READY = Object.freeze({ id: "sprite", ms: 0 });

  function load(id, src) {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
      const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false;
      tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
      sheets.set(id, { tex, w: img.width, h: img.height, data: g.getImageData(0, 0, img.width, img.height).data });
    };
    img.src = src;
  }
  if (on && typeof EmberSpriteArt !== "undefined") for (const [id, src] of Object.entries(EmberSpriteArt)) if (DEF[id]) load(id, src);
  const has = (id) => sheets.has(id);

  function material(sh, hit) {
    const m = new THREE.MeshBasicMaterial({ map: sh.tex, alphaTest: 0.5, side: THREE.DoubleSide });
    m.toneMapped = false;
    m.onBeforeCompile = (s) => {
      s.uniforms.uHitC = hit; s.uniforms.uTexels = { value: new THREE.Vector2(sh.w, sh.h) };
      s.fragmentShader = "uniform vec3 uHitC; uniform vec2 uTexels;\n" + s.fragmentShader.replace("#include <map_fragment>", `
        vec2 tp = vMapUv * uTexels, seam = floor(tp + 0.5);
        tp = seam + clamp((tp - seam) / max(fwidth(tp), vec2(1e-4)), -0.5, 0.5);   // square texels, one soft screen pixel at seams
        diffuseColor *= texture2D(map, tp / uTexels);
        diffuseColor.rgb += uHitC * (0.45 + 0.55 * diffuseColor.rgb);`);
    };
    m.customProgramCacheKey = () => "ember-sprite";
    return m;
  }

  // the camera's last orientation (a figure assembles before its first draw: the battlefield camera's 30° pitch)
  const camQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 6, 0, 0));
  const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion(), _d = new THREE.Vector3(), _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), ONE = new THREE.Vector3(1, 1, 1);
  /** the sprite quad's world matrix: at its root, facing the camera, posed (offset along its facing, tilted, squashed) */
  function place(fig, out) {
    const P = fig.pose, root = fig.root, d = DEF[fig.id];
    root.getWorldPosition(_p); root.getWorldQuaternion(_q); const k = root.getWorldScale(_s).x;
    _d.set(0, 0, 1).applyQuaternion(_q);
    if (Math.abs(_d.x) > 0.08) fig.dir = Math.sign(_d.x);
    const f = fig.dir;
    out.compose(_p, camQ, ONE);
    out.multiply(_l.makeScale(k, k, k));
    out.multiply(_l.makeTranslation(P.x * f, P.y + (d.hover || 0), 0));
    out.multiply(_l.makeRotationZ(-P.tilt * f));
    return out.multiply(_l.makeScale(P.sx * f * d.faces, P.sy, 1));
  }

  function build(id, o = {}) {
    const sh = sheets.get(id), spec = EmberVoxelKit.get(id), d = DEF[id];
    const geo = new THREE.PlaneGeometry(sh.w * PX, sh.h * PX).translate(0, (sh.h * PX) / 2, 0);
    geo.computeBoundingBox();
    const hit = { value: new THREE.Vector3() }, mat = material(sh, hit);
    const mesh = new THREE.Mesh(geo, mat), root = new THREE.Group();
    mesh.layers.set(LAYER); mesh.frustumCulled = false;
    root.add(mesh);
    const fig = { sprite: true, id, spec, kind: spec.kind, root, mesh, J: {}, props: [], mats: [mat], geos: [geo], hit, sheet: sh,
      dir: d.faces, phase: Math.random() * 6.28, pose: { x: 0, y: 0, tilt: 0, sx: 1, sy: 1 }, vox: null };
    mesh.onBeforeRender = (r, s, cam) => { camQ.copy(cam.quaternion); place(fig, mesh.matrixWorld); };
    // the palette the arena's debris and bursts use: a sample of its opaque pixels
    const col = [];
    for (let i = 0; i < sh.w * sh.h; i += 7) if (sh.data[i * 4 + 3] > 127) col.push(...lin(sh.data, i));
    fig.vox = { bone: new Array(col.length / 3).fill(0), color: new Float32Array(col) };
    return fig;
  }
  const lin = (D, i) => [0, 1, 2].map((c) => Math.pow(D[i * 4 + c] / 255, 2.2));

  /** its opaque pixels in world space at the current pose (centres, colours, shard size) — for assembling and shattering */
  function pixelsWorld(fig) {
    fig.root.updateMatrixWorld(true);
    const sh = fig.sheet, M = place(fig, _m), pts = [], cols = [], v = new THREE.Vector3(), step = 2;
    for (let y = 0; y < sh.h; y += step) for (let x = 0; x < sh.w; x += step) {
      const i = y * sh.w + x;
      if (sh.data[i * 4 + 3] < 128) continue;
      v.set((x + 0.5 - sh.w / 2) * PX, (sh.h - y - 0.5) * PX, 0).applyMatrix4(M);
      pts.push(v.x, v.y, v.z); cols.push(...lin(sh.data, i));
    }
    return { pts: new Float32Array(pts), cols: new Float32Array(cols), size: PX * step * 1.4 * fig.root.getWorldScale(_s).x };
  }

  const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  /** clip ∈ idle | attack | hurt | victory | rest; t = seconds into the clip, T = global time → false once it ended */
  function pose(fig, clip, t, T) {
    const P = fig.pose, br = Math.sin(T * 2.6 + fig.phase);
    P.x = 0; P.tilt = 0; P.sx = 1 - 0.012 * br; P.sy = 1 + 0.022 * br;
    P.y = DEF[fig.id].hover ? 0.025 * Math.sin(T * 2.2 + fig.phase) : 0;
    if (clip === "rest") { P.sx = P.sy = 1; P.y = 0; return true; }
    if (clip === "idle") return true;
    if (clip === "attack") {
      const { hit: H, length: L } = C.timing(fig), ranged = !!fig.spec.moves?.attack?.ranged, k = ranged ? 0.6 : 1;
      const coil = t < H * 0.7 ? ease(t / (H * 0.7)) : 0;
      const strike = t < H * 0.7 ? 0 : t < H ? ease((t - H * 0.7) / (H * 0.3)) : 1 - ease((t - H - 0.08) / Math.max(0.1, L - H - 0.08));
      P.tilt = (-0.16 * coil + 0.24 * strike) * k;
      P.x = (-0.035 * coil + 0.09 * strike) * k;
      P.sx *= 1 + 0.07 * coil - 0.03 * strike; P.sy *= 1 - 0.08 * coil + 0.07 * strike;
      if (ranged) P.y += 0.05 * strike;
      return t < L;
    }
    if (clip === "hurt") {
      const q = Math.max(0, 1 - t / 0.34);
      P.tilt = -0.2 * q * q; P.x = -0.06 * q * q + 0.014 * Math.sin(t * 70) * q;
      P.sx *= 1 + 0.05 * q; P.sy *= 1 - 0.05 * q;
      return t < 0.34;
    }
    if (clip === "victory") {
      const hop = Math.abs(Math.sin((t / 0.42) * Math.PI));
      P.y += 0.12 * hop; P.sy *= 1 + 0.05 * hop; P.sx *= 1 - 0.03 * hop;
      return t < 1.26;
    }
    return false;
  }

  // plug into the figure renderer and clips: sprite ids build here, every other figure as before
  const base = { build: R.build, cached: R.cached, dispose: R.dispose, setHit: R.setHit, setEmit: R.setEmit, setFace: R.setFace, setPixelRatio: R.setPixelRatio, voxelsWorld: R.voxelsWorld, pose: C.pose };
  R.cached = (id) => (has(id) ? READY : base.cached(id));
  R.build = (id, o) => (has(id) ? build(id, o) : base.build(id, o));
  R.dispose = (fig) => { if (!fig.sprite) return base.dispose(fig); for (const g of fig.geos) g.dispose(); for (const m of fig.mats) m.dispose(); };
  R.setHit = (fig, r, g, b) => (fig.sprite ? fig.hit.value.set(r, g, b) : base.setHit(fig, r, g, b));
  R.setEmit = (fig, k) => (fig.sprite ? undefined : base.setEmit(fig, k));
  R.setFace = (fig, e) => (fig.sprite ? undefined : base.setFace(fig, e));
  R.setPixelRatio = (fig, pr) => (fig.sprite ? undefined : base.setPixelRatio(fig, pr));
  R.voxelsWorld = (fig) => (fig.sprite ? pixelsWorld(fig) : base.voxelsWorld(fig));
  C.pose = (fig, clip, t, T) => (fig.sprite ? pose(fig, clip, t, T) : base.pose(fig, clip, t, T));

  return Object.freeze({ LAYER, has, ids: () => [...sheets.keys()], on });
})();
