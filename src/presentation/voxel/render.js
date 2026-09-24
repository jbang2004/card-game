/* EmberVoxelRender — turns a voxel figure into something three.js can pose and draw:
 * bake(id) samples the figure's sculpture into cubes (EmberVoxel, cached per figure),
 * build(id) makes one SkinnedMesh on the figure's skeleton, props on bone holders,
 * pixel-art faces per expression, and the voxel material: flat-lit cubes with their
 * baked corner AO, a golden-hour key, a mauve sky fill, the peach Fresnel rim of
 * Voxel Musou's hero, the victim glow (1 frame white-hot, then a decaying wash) and the
 * voxel-musou grade (split tone, Lottes curve, 40-level 2 px ordered dither) done in
 * the fragment shader, so a figure looks the same on a transparent battle overlay as
 * in the workbench — no post pass. See docs/design/MINIATURES.md. */
const EmberVoxelRender = (() => {
  const THREE = EmberVesperThree, K = EmberVoxelKit;
  const V = 0.0125, VPROP = 0.0075;               // voxel sizes (body, props)

  // ------------------------------------------------------------------ light + grade
  // golden hour: warm sun from the upper front-right, mauve sky, dusty ground bounce, peach back light
  const LIGHT = { key: [0.5, 0.7, 0.6], keyCol: 0xffd9b8, keyI: 1.45, fill: [-0.7, 0.25, 0.5], fillCol: 0x8fa6d8, fillI: 0.28,
    rim: [-0.55, 0.35, -0.75], rimCol: 0xffb07a, rimI: 1.0, sky: 0xaeaac6, skyI: 0.62, ground: 0x8e7a6e, groundI: 0.36 };
  const GRADE = { expo: 0.7, a: 2.0, mi: 0.18, mo: 0.18, hm: 6 };
  /** Lottes curve constants: scene luminance mi → display mo, hm → 1, mid slope a, shoulder 0.97 */
  function lottes({ a, mi, mo, hm }) {
    const ad = a * 0.97, den = (hm ** ad - mi ** ad) * mo;
    return { a, b: (hm ** a * mo - mi ** a) / den, c: (hm ** ad * mi ** a - hm ** a * mi ** ad * mo) / den };
  }
  // shared by every voxel shader (figures, workbench backdrop): split tone, saturation, Lottes curve on luminance,
  // per-channel soft shoulder (fire walks orange → yellow → white), only the hottest cores bleach
  const GRADE_GLSL = /* glsl */ `
    uniform float uTmA; uniform float uTmB; uniform float uTmC;
    vec3 voxGrade(vec3 c) {
      const vec3 SH_T = vec3(0.9, 0.93, 1.12), HI_T = vec3(1.12, 1.0, 0.74);
      float L = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
      float cool = smoothstep(0.0, 0.25, (c.b - c.r) / max(c.b, 1e-4));
      c *= mix(mix(SH_T, mix(HI_T, vec3(0.97, 1.0, 1.06), cool), smoothstep(0.02, 0.4, L)), vec3(1.0), smoothstep(1.2, 3.0, L));
      L = max(dot(c, vec3(0.2126, 0.7152, 0.0722)), 1e-6);
      c = max(mix(vec3(L), c, 1.22), 0.0);
      c *= pow(L, uTmA) / (pow(L, uTmA * 0.97) * uTmB + uTmC) / L;
      float pk = max(c.r, max(c.g, c.b));
      c = min(c, 0.75) + 0.25 * (1.0 - exp(-max(c - 0.75, 0.0) / 0.25));
      float pk2 = max(c.r, max(c.g, c.b));
      c = mix(c, vec3(pk2), 1.0 - 1.0 / (0.25 * max(pk - pk2, 0.0) + 1.0));
      return 0.006 * vec3(1.0, 0.8, 0.75) + min(c, 1.0) * (1.0 - 0.006);
    }
    uniform float uDither; uniform float uPixS;
    float voxBayer(vec2 p) { int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4; int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(m[i]) + 0.5) / 16.0 - 0.5; }
    // display space: 2 px ordered dither and 40 levels, the retro grain of the voxel look
    vec3 voxDither(vec3 c) {
      vec2 fc = floor(gl_FragCoord.xy / uPixS);
      c += voxBayer(floor(fc * 0.5)) * 0.8 / 40.0 * uDither;
      return mix(c, floor(c * 40.0 + 0.5) / 40.0, uDither);
    }`;

  const VERT = /* glsl */ `
    #include <common>
    #include <skinning_pars_vertex>
    attribute vec3 albedo; attribute vec4 aux; attribute vec4 aux2; attribute vec4 face;
    varying vec3 vN; varying vec3 vW; varying vec3 vAlb; varying vec4 vAux; varying vec4 vAux2; varying vec4 vFace;
    void main() {
      #include <beginnormal_vertex>
      #include <skinbase_vertex>
      #include <skinnormal_vertex>
      #include <begin_vertex>
      #include <skinning_vertex>
      vec4 wp = modelMatrix * vec4(transformed, 1.0);
      vW = wp.xyz; vN = normalize(mat3(modelMatrix) * objectNormal);
      vAlb = albedo; vAux = aux; vAux2 = aux2; vFace = face;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const FRAG = /* glsl */ `
    uniform vec3 uKeyDir; uniform vec3 uKeyCol; uniform vec3 uFillDir; uniform vec3 uFillCol; uniform vec3 uRimDir; uniform vec3 uRimCol;
    uniform vec3 uSky; uniform vec3 uGround; uniform sampler2D uFace; uniform float uHasFace; uniform vec3 uHitC; uniform float uEmit;
    uniform float uExpo; uniform float uAlpha;
    varying vec3 vN; varying vec3 vW; varying vec3 vAlb; varying vec4 vAux; varying vec4 vAux2; varying vec4 vFace;
    ${GRADE_GLSL}
    void main() {
      vec3 alb = vAlb;
      float ao = vAux.x, metal = vAux2.x, emit = vAux2.y, cls = floor(vAux2.z + 0.5);
      float decal = 0.0;
      if (uHasFace > 0.5 && vFace.z > 0.001) { vec4 dec = texture2D(uFace, vFace.xy); decal = dec.a * vFace.z; alb = mix(alb, dec.rgb, decal); }
      vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
      vec3 V = normalize(cameraPosition - vW), L = normalize(uKeyDir), Rd = normalize(uRimDir);
      float ndv = clamp(dot(N, V), 1e-3, 1.0), ndl = dot(N, L);
      bool skin = abs(cls - 1.0) < 0.5 || abs(cls - 8.0) < 0.5;
      ao = mix(ao, 1.0, (skin ? 0.75 * smoothstep(0.2, 0.7, vFace.z) : 0.0) + 0.5 * decal);
      // flat-lit cubes: key + sky/ground + fill, then the hero look (camera fill and a peach Fresnel rim, faded where
      // the surface is already bright), metal glints, glow
      float lam = max(ndl, 0.0);
      vec3 amb = mix(uGround, uSky, N.y * 0.5 + 0.5);
      vec3 col = alb * (uKeyCol * lam + amb + uFillCol * max(dot(N, normalize(uFillDir)), 0.0)) * mix(0.55, 1.0, ao);
      vec3 nv = normalize((viewMatrix * vec4(N, 0.0)).xyz);
      float fl = max(dot(nv, normalize(vec3(-0.4, 0.55, 0.75))), 0.0) * 0.8 + 0.2;
      vec3 extra = alb * (0.4 * fl * vec3(0.78, 0.84, 1.0) + 0.9 * pow(1.0 - ndv, 2.5) * vec3(1.0, 0.7, 0.45) * max(dot(N, Rd) * 0.5 + 0.5, 0.0));
      col += extra * (1.0 - smoothstep(0.2, 0.85, dot(col, vec3(0.2126, 0.7152, 0.0722)))) * mix(0.6, 1.0, ao);
      if (metal > 0.3) { vec3 R = reflect(-V, N); col += alb * (uKeyCol * pow(max(dot(R, L), 0.0), 10.0) * 1.6 + mix(uGround, uSky, R.y * 0.5 + 0.5) * 0.5) * metal * ao; }
      col += alb * emit * uEmit;
      // victim glow (Voxel Musou hitfx): contact frame = white-hot silhouette, then a wash with a glowing rim
      float hitA = max(uHitC.r, max(uHitC.g, uHitC.b));
      if (hitA > 0.0) {
        float hitRim = 1.0 - ndv;
        if (hitA > 1.01) col = mix(col, vec3(1.0), 0.15) + (uHitC - 1.0) * (0.1 + 1.3 * hitRim * hitRim) * 2.2;
        else {
          vec3 hc = uHitC / hitA;
          col = mix(col, hc * (0.33 + 1.3 * dot(alb, vec3(0.3, 0.59, 0.11))), 0.22 * hitA);
          col += hc * hitA * (0.04 + 0.2 * clamp((0.45 - hc.g) * 4.0, 0.0, 1.0) + 0.9 * hitRim * hitRim * hitRim);
        }
      }
      col = clamp(col, 0.0, 64.0);
      if (isnan(col.r + col.g + col.b)) col = vec3(0.0);
      gl_FragColor = vec4(voxGrade(col * uExpo), uAlpha);
      #include <colorspace_fragment>
      gl_FragColor.rgb = voxDither(gl_FragColor.rgb);
    }`;

  const v3 = (a) => new THREE.Vector3(...a);
  const col = (h, k = 1) => new THREE.Color(h).multiplyScalar(k);
  const TM = lottes(GRADE);
  /** uniforms of the shared grade (every voxel shader) */
  function gradeUniforms(opts = {}) {
    return { uTmA: { value: TM.a }, uTmB: { value: TM.b }, uTmC: { value: TM.c }, uDither: { value: opts.dither ?? 1 }, uPixS: { value: opts.pixelRatio ?? 1 } };
  }
  function material(opts = {}) {
    const L = LIGHT;
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uKeyDir: { value: v3(L.key) }, uKeyCol: { value: col(L.keyCol, L.keyI) }, uFillDir: { value: v3(L.fill) }, uFillCol: { value: col(L.fillCol, L.fillI) },
        uRimDir: { value: v3(L.rim) }, uRimCol: { value: col(L.rimCol, L.rimI) }, uSky: { value: col(L.sky, L.skyI) }, uGround: { value: col(L.ground, L.groundI) },
        uFace: { value: null }, uHasFace: { value: 0 }, uHitC: { value: new THREE.Vector3() }, uEmit: { value: 1.8 },
        uExpo: { value: opts.expo ?? GRADE.expo }, uAlpha: { value: 1 }, ...gradeUniforms(opts),
      },
      vertexShader: VERT, fragmentShader: FRAG,
    });
    m.toneMapped = false;                          // graded in the shader (voxGrade), sRGB by the renderer's output
    return m;
  }

  // ------------------------------------------------------------------ pixel faces
  /* one texel per voxel face (grid from EmberVoxel), features placed in voxel units off the centre line, as in Voxel
   * Musou's hero: lash line over sclera | iris | winged outer corner, brows a row above with a skin gap, a nose shadow
   * pixel, a two-pixel mouth. kind: "human" (P = family landmarks) | "wolf" (P = { cx, cy, dx }) */
  const mixHex = (a, b, t) => {
    const c = new THREE.Color(a), d = new THREE.Color(b);
    return "#" + c.lerp(d, t).getHexString();
  };
  function pixelFace(G, kind, P, look, expr) {
    const c = document.createElement("canvas"); c.width = G.W; c.height = G.H;
    const g = c.getContext("2d");
    const colX = (x) => Math.floor((x - G.ox) / G.v) - G.i0, row = (y) => Math.floor((y - G.oy) / G.v) - G.j0;
    const px = (i, r, css) => { if (i < 0 || r < 0 || i >= G.W || r >= G.H || !css) return; g.fillStyle = css; g.fillRect(i, G.H - 1 - r, 1, 1); };
    const cR = colX(G.v * 0.5), cL = colX(-G.v * 0.5);
    const side = (s, k) => (s > 0 ? cR + k : cL - k);
    const hex = (n) => (typeof n === "number" ? "#" + n.toString(16).padStart(6, "0") : n);
    if (kind === "human") {
      const ink = look.lash || "#1d120c", brow = look.brow, iris = hex(look.eye), scl = "#e9e2d8", lip = look.lip || "#a05a50", dark = "#4a1c18", shade = look.skinD || "#d49c86";
      const ir = row(P.eyeY) - 1, lr = ir + 1, br = ir + 3, nose = ir - 2, mouth = ir - 4;
      for (const s of [1, -1]) {
        const e1 = side(s, 1), e2 = side(s, 2), e3 = side(s, 3), e4 = side(s, 4);
        if (expr === "closed") { for (const e of [e1, e2, e3]) px(e, ir, ink); px(e4, lr, ink); }
        else if (expr === "hurt") { px(e1, ir, ink); px(e2, ir, ink); px(e3, lr, ink); px(e1, lr + 1, brow); px(e2, lr + 1, brow); }
        else {
          const focus = expr === "focus", fierce = expr === "fierce";
          px(e1, ir, focus ? ink : scl); px(e2, ir, iris); px(e3, ir, ink);
          for (const e of [e1, e2, e3, e4]) px(e, lr, ink);
          if (fierce) { px(e1, br - 1, brow); px(e2, br, brow); px(e3, br, brow); px(e4, br + 1, brow); }
          else if (focus) { px(e1, br - 1, brow); px(e2, br - 1, brow); px(e3, br, brow); }
          else { px(e1, br, brow); px(e2, br, brow); px(e3, br + 1, brow); }
        }
        px(side(s, 4), ir - 2, "rgba(220,120,105,.55)");
      }
      px(cR, nose, shade);
      // an open mouth (dark) only when shouting or hurt; at rest the lips close to a soft line — lip colour half into
      // the skin's shade, so a close view does not read as a surprised "o"
      if (expr === "fierce") { px(cL, mouth, dark); px(cR, mouth, dark); }
      else if (expr === "hurt") { px(cL, mouth, dark); px(cR, mouth, dark); px(side(1, 1), mouth - 1, lip); }
      else { const soft = mixHex(lip, shade, 0.5); px(cL, mouth, soft); px(cR, mouth, soft); }
    } else if (kind === "wolf") {
      const ey = row(P.cy), rim = look.rim || "#2a2c33", blue = hex(look.eye), pup = "#0b0d12", hi = "#eaf8ff";
      for (const s of [1, -1]) {
        const a = colX(P.cx + s * P.dx), b = a + (s > 0 ? 1 : -1);
        if (expr === "closed" || expr === "hurt") { px(a, ey, rim); px(b, ey, rim); if (expr === "hurt") px(b, ey + 1, rim); continue; }
        px(a, ey + 1, rim); px(b, ey + 1, rim);
        px(a, ey, expr === "fierce" ? pup : blue); px(b, ey, blue);
        px(a, ey - 1, blue); px(b, ey - 1, expr === "fierce" ? rim : hi);
      }
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  const EXPRESSIONS = { human: ["open", "closed", "fierce", "hurt", "focus"], wolf: ["open", "closed", "fierce", "hurt"] };

  // ------------------------------------------------------------------ bake (cached)
  const baked = new Map();
  /** voxelize a figure (and its props); cached per figure id. `data` lets a worker's result be injected. */
  function bake(id, data) {
    if (data) { baked.set(id, data); return data; }
    if (baked.has(id)) return baked.get(id);
    const out = K.bakeData(id, V, VPROP);                  // in the page: EmberVoxelBaker does the same in a worker
    baked.set(id, out);
    return out;
  }

  // ------------------------------------------------------------------ figure
  function geometry(m) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(m.position, 3));
    g.setAttribute("normal", new THREE.BufferAttribute(m.normal, 3));
    g.setAttribute("albedo", new THREE.BufferAttribute(m.color, 3));
    g.setAttribute("aux", new THREE.BufferAttribute(m.aux, 4));
    g.setAttribute("aux2", new THREE.BufferAttribute(m.aux2, 4));
    g.setAttribute("face", new THREE.BufferAttribute(m.face, 4));
    if (m.skinIndex) {
      g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(m.skinIndex, 4));
      g.setAttribute("skinWeight", new THREE.BufferAttribute(m.skinWeight, 4));
    }
    g.setIndex(new THREE.BufferAttribute(m.index, 1));
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  function skeleton(bones) {
    const out = bones.map((b) => { const o = new THREE.Bone(); o.name = b.name; return o; });
    bones.forEach((b, i) => {
      if (b.parent >= 0) {
        const p = bones[b.parent].head;
        out[b.parent].add(out[i]);
        out[i].position.set(b.head[0] - p[0], b.head[1] - p[1], b.head[2] - p[2]);
      } else out[i].position.set(b.head[0], b.head[1], b.head[2]);
    });
    return out;
  }
  // grip frame for a hand prop: Y along the fist's grip axis (≈ +Z in the A-pose)
  function gripQuat(dir, flip = 1, spin = 0) {
    const d = v3(dir).normalize();
    const y = new THREE.Vector3(0, 0, flip).addScaledVector(d, -d.z * flip).normalize();
    const x = new THREE.Vector3().crossVectors(y, d).normalize();
    const z = new THREE.Vector3().crossVectors(x, y).normalize();
    const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    if (spin) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
    return q;
  }

  /** build a posable figure for figure id (opts: expo, dither, pixelRatio) */
  function build(id, opts = {}) {
    const spec = K.get(id), B = bake(id), b = B.main, ch = B.ch;
    const root = new THREE.Group();
    const bones = skeleton(b.bones);
    b.bones.forEach((bn, i) => { if (bn.parent < 0) root.add(bones[i]); });
    root.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(bones);
    const J = {}; bones.forEach((bn) => (J[bn.name] = bn));
    const mat = material(opts);
    const geo = geometry(b);
    const mesh = new THREE.SkinnedMesh(geo, mat);
    mesh.bind(skel, new THREE.Matrix4()); mesh.frustumCulled = false;
    root.add(mesh);
    const fig = { id, spec, kind: ch.kind || spec.kind, char: ch, root, J, skel, bones, mesh, mats: [mat], geos: [geo], props: [], vox: b.vox, faces: null, face: null };
    // props: static meshes on bone holders, gripped in the fist for spear/bow
    for (const p of B.props) {
      const bone = J[p.bone];
      const g = geometry(p.bake), pm = material(opts);
      const holder = new THREE.Group();
      const head = b.bones.find((bn) => bn.name === p.bone).head;
      let at = p.at, quat = null;
      if ((p.grip === "spear" || p.grip === "bow") && ch.P) {
        const s = p.bone === "handL" ? 1 : -1, a = K.armJoints(ch.P, s), q = ch.P.hand;
        const n = new THREE.Vector3().crossVectors(v3(a.dir), new THREE.Vector3(0, 0, s)).normalize();
        at = [a.W[0] + a.dir[0] * 0.044 * q + n.x * 0.004 * q, a.W[1] + a.dir[1] * 0.044 * q + n.y * 0.004 * q, a.W[2] + a.dir[2] * 0.044 * q + n.z * 0.004 * q];
        quat = gripQuat(a.dir, 1, p.grip === "bow" ? Math.PI / 2 : 0);
      }
      holder.position.set(at[0] - head[0], at[1] - head[1], at[2] - head[2]);
      if (quat) holder.quaternion.copy(quat); else if (p.rot) holder.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      bone.add(holder);
      const m = new THREE.Mesh(g, pm); m.frustumCulled = false; holder.add(m);
      fig.geos.push(g); fig.mats.push(pm);
      fig.props.push({ holder, grip: p.grip, bone: p.bone, mesh: m });
    }
    // faces
    const grid = b.faceGrid && b.faceGrid[0];
    if (spec.face && grid && typeof document !== "undefined") {
      const P = spec.face.kind === "human" ? ch.P : spec.face.params(ch);
      fig.faces = {};
      for (const e of EXPRESSIONS[spec.face.kind] || ["open"]) fig.faces[e] = pixelFace(grid, spec.face.kind, P, spec.face.look, e);
    }
    fig.rest = new Map();
    root.traverse((o) => fig.rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
    setFace(fig, "open");
    return fig;
  }
  function setFace(fig, e) {
    if (!fig.faces || fig.face === e) return;
    fig.face = e;
    const t = fig.faces[e] || fig.faces.open;
    fig.mats[0].uniforms.uFace.value = t; fig.mats[0].uniforms.uHasFace.value = 1;
  }
  /** victim glow on the body (props stay untinted): rgb = colour × strength, > 1 = the white-hot contact frame */
  function setHit(fig, r, g, b) { fig.mats[0].uniforms.uHitC.value.set(r, g, b); }
  function setEmit(fig, k) { for (const m of fig.mats) m.uniforms.uEmit.value = 1.8 * k; }
  function setPixelRatio(fig, pr) { for (const m of fig.mats) m.uniforms.uPixS.value = pr; }
  function dispose(fig) {
    for (const g of fig.geos) g.dispose();
    for (const m of fig.mats) m.dispose();
    if (fig.faces) for (const t of Object.values(fig.faces)) t.dispose();
  }
  /** a figure's exposed voxels in world space at its current pose (centres, colours, voxel size) — for shattering */
  function voxelsWorld(fig) {
    fig.root.updateMatrixWorld(true);
    const bones = fig.skel.bones, inv = fig.skel.boneInverses, mats = bones.map((bn, i) => new THREE.Matrix4().multiplyMatrices(bn.matrixWorld, inv[i]));
    const Vx = fig.vox, n = Vx.bone.length, out = new Float32Array(n * 3), p = new THREE.Vector3();
    for (let i = 0; i < n; i++) { p.fromArray(Vx.center, i * 3).applyMatrix4(mats[Vx.bone[i]]); out[i * 3] = p.x; out[i * 3 + 1] = p.y; out[i * 3 + 2] = p.z; }
    const s = fig.root.getWorldScale(new THREE.Vector3()).x;
    return { pts: out, cols: Vx.color, size: Vx.size * s };
  }

  /** a figure's bake if it is already cached (never bakes) */
  const cached = (id) => baked.get(id) || null;
  return { LIGHT, GRADE, GRADE_GLSL, gradeUniforms, V, VPROP, material, pixelFace, bake, cached, build, setFace, setHit, setEmit, setPixelRatio, dispose, voxelsWorld, gripQuat, geometry, skeleton };
})();
