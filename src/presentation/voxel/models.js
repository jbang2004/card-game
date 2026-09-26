/* EmberModelFigures — rigged 3D models on the battlefield (docs/design/MINIATURES.md). A figure whose model is in
 * EmberModelArt (a Tripo model on the Mixamo skeleton, skin repaired by tools/model_art.cjs) stands as that skinned
 * mesh instead of its sculpted figure or sprite: unlit (its painted texture is the look), drawn at full resolution
 * over the pixel pass (camera layer EmberSpriteFigures.LAYER; `?model=pixel` puts it through the pass like the
 * sculpted figures, `?model=0` leaves the figure to the sprite or sculpt). It keeps its figure's spec (size, moves)
 * and plugs into EmberVoxelRender / EmberVoxelClips, so the arena stations, turns, cues and shatters it like any
 * other figure. Its clips turn the skeleton's bones in the model's own space (+z forward, +y up):
 *   · idle breathes, shifts its weight, glances down at the weapon now and then, blinks
 *   · attack flips the weapon from its resting point-down hold into a forward grip as the arm coils back over the
 *     shoulder (the blade hangs behind the head), steps in on the front foot and chops down in an arc onto the
 *     director's contact, then settles back into the resting hold; the shield tucks aside
 *   · hurt is knocked back behind the raised shield, eyes squeezed · victory raises the weapon and hops
 *   · the hair and cape behind (the "Back" joint) swing on a spring after every dash, hit and hop
 *   · the hit glow washes the texture. */
const EmberModelFigures = (() => {
  const THREE = EmberVesperThree, R = EmberVoxelRender, C = EmberVoxelClips;
  const mode = typeof location === "undefined" ? "" : new URLSearchParams(location.search).get("model") || "";
  const on = mode !== "0", LAYER = mode === "pixel" ? 0 : EmberSpriteFigures.LAYER;
  const models = new Map();                  // id → { geo, tex, data, size, joints, ibm, blade, eyes }
  const onReady = new Set();                 // told when a model is ready (the battlefield re-syncs: one may decode late)
  // the light on a lit model (see material): one value for every figure, switchable (the model demo compares them)
  const SHADE = { value: 4 };                // 4 radiant: the look the user chose (2026-09-25)
  const READY = Object.freeze({ id: "model", ms: 0 });
  // how each model moves: "melee" (a weapon arm, a shield, feet on the ground) · "caster" (hovers on its wings, casts
  // from the off hand)
  // how far a caster's casting arm moves (× the default): the stargazer's cloak lies on her astrolabe arm
  const ARM = { oracle: 0.35 };
  const STYLE = {
    paladin: "melee", frostking: "melee", assassin: "melee", squire: "melee", solaris: "melee", reaper: "melee", leech: "melee",
    guard: "thrust", huntress: "thrust", skeleton: "thrust",
    wisp: "caster", spark: "caster", nyx: "caster", necromancer: "caster", soulguide: "caster", oracle: "caster", vesper: "archer",
  };
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const lin = (D, i) => [0, 1, 2].map((c) => Math.pow(D[i * 4 + c] / 255, 2.2));
  const texel = (M, u, v) => Math.min(M.size[1] - 1, Math.floor(v * M.size[1])) * M.size[0] + Math.min(M.size[0] - 1, Math.floor(u * M.size[0]));

  /* A model's data is inline: M.bin (base64 of the mesh; with M.z, of the mesh deflated — the Artifact build, which
   * must fit its size limit, tools/build_artifact.py), M.tex a data URI */
  function load(id, M) {
    const bytes = Uint8Array.from(atob(M.bin), (c) => c.charCodeAt(0));
    if (!M.z) { build0(id, M, bytes.buffer, M.tex); return; }
    new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer()
      .then((raw) => build0(id, M, raw, M.tex)).catch((e) => console.warn("model figure unavailable", id, e));
  }
  function build0(id, M, raw, texSrc) {
    const n = M.count;
    let off = 0;
    const take = (T, len) => { const a = new T(raw, off, len); off += Math.ceil((len * T.BYTES_PER_ELEMENT) / 4) * 4; return a; };
    const q = take(Uint16Array, n * 3), uv = take(Uint16Array, n * 2), sj = take(Uint8Array, n * 4), sw = take(Uint8Array, n * 4), idx = take(M.wide ? Uint32Array : Uint16Array, M.tris * 3);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n * 3; i++) { const c = i % 3; pos[i] = M.lo[c] + (q[i] / 65535) * (M.hi[c] - M.lo[c]); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2, true));
    geo.setAttribute("skinIndex", new THREE.BufferAttribute(sj, 4));
    geo.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4, true));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingBox();
    if (M.lit) {
      // smooth normals, welded across the uv seams (they split vertices by position), and the metal mask
      const key = new Map(), acc = new Float32Array(n * 3), slot = new Int32Array(n);
      for (let i = 0; i < n; i++) { const k = q[i * 3] + "," + q[i * 3 + 1] + "," + q[i * 3 + 2]; if (!key.has(k)) key.set(k, i); slot[i] = key.get(k); }
      const e1 = V3(), e2 = V3(), fn = V3(), pa = V3(), pb = V3(), pc = V3();
      for (let t = 0; t < idx.length; t += 3) {
        pa.fromArray(pos, idx[t] * 3); pb.fromArray(pos, idx[t + 1] * 3); pc.fromArray(pos, idx[t + 2] * 3);
        fn.crossVectors(e1.subVectors(pb, pa), e2.subVectors(pc, pa));
        for (let c = 0; c < 3; c++) { const o = slot[idx[t + c]] * 3; acc[o] += fn.x; acc[o + 1] += fn.y; acc[o + 2] += fn.z; }
      }
      const nrm = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const o = slot[i] * 3, l = Math.hypot(acc[o], acc[o + 1], acc[o + 2]) || 1; nrm[i * 3] = acc[o] / l; nrm[i * 3 + 1] = acc[o + 1] / l; nrm[i * 3 + 2] = acc[o + 2] / l; }
      geo.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
      const mt = M.mt ? Uint8Array.from(atob(M.mt), (c) => c.charCodeAt(0)) : new Uint8Array(n);
      geo.setAttribute("aMetal", new THREE.BufferAttribute(mt, 1, true));
    }
    const img = new Image();
    img.onload = () => {
      // a phone (a coarse pointer) keeps each texture at 1024: a quarter of the memory, and on its small figures the same look
      const cap = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches ? 1024 : 4096, k = Math.min(1, cap / Math.max(img.width, img.height));
      const cv = document.createElement("canvas"); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, cv.width, cv.height);
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.anisotropy = 4;       // glTF uvs: top-left origin
      const m = { geo, tex, data: g.getImageData(0, 0, cv.width, cv.height).data, size: [cv.width, cv.height], joints: M.joints, ibm: M.ibm, blade: M.blade, hold: M.hold || {}, style: M.style, lit: !!M.lit, noTuck: !!M.lit && !M.shield, beast: !!M.beast, tq: M.tq || null };
      m.eyes = m.beast ? null : findEyes(m, pos, sj, sw, uv);
      models.set(id, m);
      onReady.forEach((fn) => fn(id));
    };
    img.src = texSrc;
  }
  /** the painted eyes, found on the model rather than in the texture (a Tripo atlas scatters them over small islands):
   *  the dark-textured vertices on the front of the face, split left / right → a bind-space box per eye
   *  (x0, y0, x1, y1), the face's front depth, and the skin colour around them (linear) */
  function findEyes(M, pos, sj, sw, uv) {
    const head = M.joints.findIndex((j) => j.name === "Head");
    if (head < 0) return null;
    const hp = new THREE.Matrix4().fromArray(M.ibm, head * 16).invert(), hx = hp.elements[12], hy = hp.elements[13], hz = hp.elements[14];
    // the face is the skin on the front of the head; the eyes are the dark pixels inside it (never the hood or collar
    // around it, which dark-clad figures have right beside the face)
    const D = M.data, dark = [], skin = [0, 0, 0, 0], face = [9, 9, -9, -9];
    const front = [];
    for (let i = 0; i < pos.length / 3; i++) {
      let w = 0; for (let k = 0; k < 4; k++) if (sj[i * 4 + k] === head) w += sw[i * 4 + k] / 255;
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      if (w < 0.5 || z < hz + 0.1 || Math.abs(x - hx) > 0.13 || Math.abs(y - hy) > 0.08) continue;
      const t = texel(M, uv[i * 2] / 65535, uv[i * 2 + 1] / 65535) * 4, r = D[t], g = D[t + 1], b = D[t + 2];
      front.push([x, y, z, r, g, b]);
      if (r > 200 && g > 140 && b > 100 && r > g + 12 && g > b + 6) {
        skin[0] += r; skin[1] += g; skin[2] += b; skin[3]++;
        face[0] = Math.min(face[0], x); face[1] = Math.min(face[1], y); face[2] = Math.max(face[2], x); face[3] = Math.max(face[3], y);
      }
    }
    for (const [x, y, z, r, g, b] of front) {
      const inFace = x > face[0] + 0.01 && x < face[2] - 0.01 && y > face[1] + 0.01 && y < face[3] - 0.005;
      if (inFace && 0.3 * r + 0.59 * g + 0.11 * b < 60 && Math.abs(x - hx) > 0.022) dark.push([x, y, z]);   // the mouth sits on the centre line
    }
    const sides = [dark.filter((p) => p[0] < hx), dark.filter((p) => p[0] >= hx)];
    if (sides.some((s) => s.length < 2) || !skin[3]) return null;
    const box = (s) => { const x = s.map((p) => p[0]), y = s.map((p) => p[1]); return new THREE.Vector4(Math.min(...x) - 0.02, Math.min(...y) - 0.016, Math.max(...x) + 0.02, Math.max(...y) + 0.016); };
    const toLin = (c) => Math.pow(c / skin[3] / 255, 2.2);
    return { a: box(sides[0]), b: box(sides[1]), z: Math.min(...dark.map((p) => p[2])) - 0.02, skin: V3(toLin(skin[0]), toLin(skin[1]), toLin(skin[2])) };
  }
  if (on && typeof EmberModelArt !== "undefined") for (const [id, M] of Object.entries(EmberModelArt)) { try { load(id, M); } catch (e) { console.warn("model figure unavailable", id, e); } }
  const has = (id) => models.has(id);

  /** unlit texture + the hit glow (+ a caster's charge glow around what her off hand holds); a blink paints the dark pixels of each eye with the face's skin except a thin lid
   *  line through its middle (tested in bind space, so the atlas layout does not matter) */
  // a caster whose held thing is fire: the modelled orb is hidden and a real fireball (EmberFire) burns in its place
  const FIRE = { spark: { r: 0.075 }, jingchen: { r: 0.095 } };
  // a signature figure's lit blade (EmberSkillFx sets its strength): the blade's bind-space segment, its strength, the
  // time its shimmer runs on, and the golden rim that swells with it
  const NO_LUX = { a: { value: V3(9, 9, 9) }, b: { value: V3(9, 9, 9.1) }, k: { value: 0 }, t: { value: 0 }, rim: { value: 0 } };
  function material(M, hit, blink, glow, hide = false, lux = NO_LUX) {
    const m = new THREE.MeshBasicMaterial({ map: M.tex, side: THREE.DoubleSide });
    m.toneMapped = false;
    const E = M.eyes || { a: new THREE.Vector4(9, 9, 9, 9), b: new THREE.Vector4(9, 9, 9, 9), z: 9, skin: V3() };
    m.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, { uShade: SHADE, uHitC: hit, uBlink: blink, uGlow: glow.k, uGlowC: glow.c, uOrb: glow.at, uEyeA: { value: E.a }, uEyeB: { value: E.b }, uEyeZ: { value: E.z }, uSkin: { value: E.skin }, uAura: { value: M.beast ? 0.4 : 1 }, uHide: { value: hide ? 1 : 0 },
        uBladeA: lux.a, uBladeB: lux.b, uBladeK: lux.k, uBladeT: lux.t, uRimK: lux.rim });
      s.vertexShader = "varying vec3 vBind;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vBind = position;");
      if (M.lit) s.vertexShader = "attribute float aMetal; varying float vMetal; varying vec3 vN;\n" + s.vertexShader.replace("#include <fog_vertex>", "#include <fog_vertex>\n vMetal = aMetal; vN = normalize(transformedNormal);");
      s.fragmentShader = `#ifdef LIT
        varying float vMetal; varying vec3 vN;
        #endif
        uniform vec3 uHitC, uSkin, uGlowC, uBladeA, uBladeB; uniform float uShade, uBlink, uEyeZ, uGlow, uAura, uHide, uBladeK, uBladeT, uRimK; uniform vec4 uEyeA, uEyeB, uOrb; varying vec3 vBind;
        float lid(vec4 r) {                                   // 1 where this eye is closed over by the lid
          if (vBind.z < uEyeZ || vBind.x < r.x || vBind.x > r.z || vBind.y < r.y || vBind.y > r.w) return 0.0;
          float mid = 0.5 * (r.y + r.w), h = 0.5 * (r.w - r.y) - 0.012;
          return step((1.0 - uBlink) * h + 0.0035, abs(vBind.y - mid));
        }
        ` + s.fragmentShader.replace("#include <map_fragment>", `
          vec4 sampledDiffuseColor = texture2D(map, vMapUv);
          if (uBlink > 0.0 && dot(sampledDiffuseColor.rgb, vec3(0.3, 0.59, 0.11)) < 0.3)
            sampledDiffuseColor.rgb = mix(sampledDiffuseColor.rgb, uSkin, max(lid(uEyeA), lid(uEyeB)));
          diffuseColor *= sampledDiffuseColor;
          #ifdef LIT
          if (uHide > 0.5 && abs(vMetal - 250.0 / 255.0) < 0.003) discard;   // the orb alone (not the hand round it): real fire burns there
          {
            // what the surface is (the converter's mask): 1 polished metal (blade, shield), 0.78 head (skin), 0.5 body
            // (its gold trim shines), 0 hair. uShade: 0 the bare texture · 1 warm key · 2 soft daylight · 3 anime cel
            // (flat paint, two tones, cool shade; the figure's outline shell shows) · 4 radiant (high key, golden aura)
            vec3 N = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0), Lk = normalize(vec3(-0.45, 0.75, 0.6)), Vw = vec3(0.0, 0.0, 1.0);
            vec3 base = diffuseColor.rgb;
            float weapon = step(0.9, vMetal), head = step(0.7, vMetal) * (1.0 - weapon), body = step(0.4, vMetal) * (1.0 - head) * (1.0 - weapon);
            float mx = max(base.r, max(base.g, base.b)), mn = min(base.r, min(base.g, base.b)), sat = (mx - mn) / max(mx, 1e-3);
            float gold = smoothstep(0.35, 0.6, sat) * step(base.b, base.g) * step(base.g, base.r) * smoothstep(0.12, 0.3, mx);
            float metal = max(weapon * smoothstep(0.1, 0.4, mx), gold * body);
            // skin (on the head): the texture blurred (a coarse mip) evens out the blotches of the generated face,
            // then it is set to one clean tone at that brightness; eyes, brows and lips (dark or red) stay
            vec3 soft = texture2D(map, vMapUv, 3.5).rgb;
            float sl = dot(soft, vec3(0.3, 0.59, 0.11)), bl = dot(base, vec3(0.3, 0.59, 0.11));
            float skin = head * smoothstep(0.18, 0.32, sl) * (1.0 - smoothstep(0.42, 0.6, sat)) * step(soft.b, soft.r) * smoothstep(0.1, 0.2, bl);
            vec3 skinTone = vec3(1.0, 0.74, 0.62) * (0.42 + 0.9 * sl) + 0.25 * (base - soft);
            if (uShade > 0.5) base = mix(base, skinTone, skin * 0.8);
            float ndl = dot(N, Lk), wrap = clamp((ndl + 0.4) / 1.4, 0.0, 1.0), rim = pow(1.0 - clamp(N.z, 0.0, 1.0), 3.0);
            vec3 Rf = reflect(-Vw, N);
            float env = smoothstep(-0.35, 0.65, Rf.y) * 0.85 + 0.35 * pow(max(0.0, 1.0 - abs(Rf.x)), 6.0);
            float spec = pow(max(dot(N, normalize(Lk + Vw)), 0.0), 42.0);
            vec3 tintS = mix(vec3(1.0, 0.95, 0.88), vec3(1.0, 0.82, 0.5), gold);
            vec3 lit = base;
            if (uShade < 0.5) lit = base;
            else if (uShade < 1.5) {
              lit = base * (0.74 + 0.5 * wrap) * vec3(1.05, 1.0, 0.93);
              lit = mix(lit, base * (0.42 + 1.05 * env) + tintS * spec * 1.6, metal * 0.9);
              lit += vec3(1.0, 0.8, 0.45) * rim * 0.32;
            } else if (uShade < 2.5) {
              // daylight: a neutral key, a sky / ground fill, the skin kept warm in its shade
              float sky = 0.5 + 0.5 * N.y;
              vec3 fill = mix(vec3(0.62, 0.6, 0.62), vec3(0.78, 0.82, 0.9), sky);
              lit = base * (fill + vec3(0.5, 0.49, 0.47) * max(ndl, 0.0));
              lit += skin * base * vec3(0.12, 0.04, 0.02) * (1.0 - wrap);
              lit = mix(lit, base * (0.35 + 1.1 * env) + tintS * spec * 1.3, metal * 0.85);
              lit += vec3(0.9, 0.92, 1.0) * rim * 0.12;
            } else if (uShade < 3.5) {
              // anime cel: the painted detail flattened (a coarse mip, dark lines kept), lit and shaded tones with a
              // crisp edge, shade cool and a little purple (warm on skin), a hard glint on metal
              vec3 flat_ = texture2D(map, vMapUv, 2.5).rgb;
              flat_ = mix(flat_, skinTone, skin);
              vec3 paint = mix(base, flat_ * 1.04, (1.0 - weapon) * smoothstep(0.12, 0.3, bl) * 0.75);
              paint = mix(vec3(dot(paint, vec3(0.3, 0.59, 0.11))), paint, 1.15);
              float t = smoothstep(0.44, 0.47, wrap);
              vec3 shade = paint * mix(vec3(0.7, 0.68, 0.86), vec3(0.9, 0.72, 0.7), skin);
              lit = mix(shade, paint * 1.06, t);
              base = paint;
              float band = smoothstep(0.55, 0.6, env);
              lit = mix(lit, base * mix(0.55, 1.35, band) + tintS * step(0.6, spec) * 0.9, metal * 0.85);
              lit += vec3(1.0, 0.95, 0.85) * smoothstep(0.62, 0.66, rim) * 0.22;
            } else {
              // radiant: high key, shadows barely there, a strong golden rim like an aura, metal blazing
              lit = base * (1.02 + 0.3 * wrap) * vec3(1.07, 1.02, 0.93);
              lit = mix(lit, base * (0.6 + 1.35 * env) + tintS * spec * 2.6, metal * 0.95);
              // (a beast's dark hide keeps its colour: a fainter aura)
              lit += vec3(1.0, 0.76, 0.34) * (rim * 0.9 + pow(rim, 0.5) * 0.18) * uAura;
              lit = mix(lit, vec3(1.0, 0.93, 0.78), 0.08 * uAura);
            }
            // a lit blade: the metal along the blade's segment burns gold, a brighter band running up it toward the
            // point; the golden rim swells with it
            if (uBladeK > 0.0) {
              vec3 ab = uBladeB - uBladeA; float bs = dot(vBind - uBladeA, ab) / dot(ab, ab);
              float bd = length(vBind - (uBladeA + ab * clamp(bs, 0.0, 1.0)));
              float on = weapon * (1.0 - smoothstep(0.04, 0.075, bd)) * step(-0.08, bs);
              float band = exp(-pow((fract(bs * 0.85 - uBladeT * 0.55) - 0.5) * 6.0, 2.0));
              lit += vec3(1.0, 0.72, 0.32) * uBladeK * on * (0.4 + 0.6 * band + 0.35 * clamp(bs, 0.0, 1.0));
            }
            lit += vec3(1.0, 0.76, 0.34) * (rim + 0.25 * pow(rim, 0.5)) * uRimK;
            diffuseColor.rgb = lit;
          }
          #endif
          diffuseColor.rgb += uHitC * (0.45 + 0.55 * diffuseColor.rgb);
          if (uGlow > 0.0) diffuseColor.rgb += uGlowC * uGlow * (1.0 - smoothstep(0.4, 1.0, distance(vBind, uOrb.xyz) / uOrb.w));`);
    };
    if (M.lit) m.defines = { LIT: "" };
    m.customProgramCacheKey = () => (M.lit ? "ember-model-lit" : "ember-model");
    return m;
  }

  /** a beast (tools/beast_prep.cjs): the model skinned to its voxel figure's own skeleton (same bone names, rest
   *  rotations identity), so the figure's clips and custom pose (EmberVoxelClips) move it unchanged */
  function buildBeast(id) {
    const M = models.get(id), spec = EmberVoxelKit.get(id), root = new THREE.Group();
    const bones = M.joints.map((j) => { const b = new THREE.Bone(); b.name = j.name; b.position.fromArray(j.t); return b; });
    M.joints.forEach((j, i) => (j.parent >= 0 ? bones[j.parent] : root).add(bones[i]));
    const inv = M.joints.map((_, i) => new THREE.Matrix4().fromArray(M.ibm, i * 16));
    const tint = new THREE.Color(spec.moves?.attack?.tint ?? 0xffd070);
    const hit = { value: V3() }, blink = { value: 0 }, glow = { k: { value: 0 }, c: { value: V3(tint.r, tint.g, tint.b) }, at: { value: new THREE.Vector4(0, -9, 0, 0.09) } };
    const mat = material(M, hit, blink, glow), mesh = new THREE.SkinnedMesh(M.geo, mat);
    mesh.frustumCulled = false; mesh.layers.set(LAYER);
    root.add(mesh); root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones, inv), new THREE.Matrix4());
    const om = new THREE.MeshBasicMaterial({ color: 0x3a2a1e, side: THREE.BackSide });
    om.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <skinning_vertex>", "#include <skinning_vertex>\n transformed += normalize(objectNormal) * 0.0055;").replace("#include <project_vertex>", "#include <project_vertex>\n gl_Position.z += 0.0015 * gl_Position.w;"); };
    om.customProgramCacheKey = () => "ember-model-outline";
    const outline = new THREE.SkinnedMesh(M.geo, om);
    outline.frustumCulled = false; outline.layers.set(LAYER); outline.visible = false;
    root.add(outline); outline.bind(mesh.skeleton, new THREE.Matrix4());
    const cols = [], uv = M.geo.attributes.uv;
    for (let i = 0; i < uv.count; i += 37) cols.push(...lin(M.data, texel(M, uv.getX(i), uv.getY(i))));
    const rest = new Map(); root.traverse((o) => rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }));
    return { model: true, beast: true, id, spec, kind: spec.kind, char: { kind: spec.kind }, root, mesh, outline, bones, J: Object.fromEntries(bones.map((b) => [b.name, b])), skel: mesh.skeleton, rest,
      props: [], mats: [mat, om], geos: [], hit, blink, glow, M, style: "beast", faces: null, face: null, phase: Math.random() * 6.28,
      vox: { bone: new Array(cols.length / 3).fill(0), color: new Float32Array(cols) } };
  }
  function build(id) {
    if (models.get(id).beast) return buildBeast(id);
    const M = models.get(id), spec = EmberVoxelKit.get(id), root = new THREE.Group();
    const bones = M.joints.map((j) => { const b = new THREE.Bone(); b.name = j.name; b.position.fromArray(j.t); b.quaternion.fromArray(j.r); b.scale.fromArray(j.s); return b; });
    M.joints.forEach((j, i) => (j.parent >= 0 ? bones[j.parent] : root).add(bones[i]));
    const inv = M.joints.map((_, i) => new THREE.Matrix4().fromArray(M.ibm, i * 16));
    const tint = new THREE.Color(spec.moves?.attack?.tint ?? 0xffd070);
    // a caster works with the hand that holds something (orb, lantern, scepter, astrolabe); the other stays free
    const side = M.hold.L ? "L" : M.hold.R ? "R" : "L", held = M.hold[side];
    const glow = { k: { value: 0 }, c: { value: V3(tint.r, tint.g, tint.b) }, at: { value: new THREE.Vector4(...(held || [0, -9, 0]), 0.09) } };
    if (M.style === "judgment" && M.blade) { const b0 = V3(...M.blade[0]), b1 = V3(...M.blade[1]); glow.at.value.set(...b0.clone().lerp(b1, 0.5).toArray(), b0.distanceTo(b1) * 0.62); }
    const fireCfg = typeof EmberFire !== "undefined" && M.hold[side] ? FIRE[id] : null;
    const B = Object.fromEntries(bones.map((b) => [b.name, b]));
    const weapon = { R: weaponHolder(M, B, inv, "Right"), L: weaponHolder(M, B, inv, "Left") };
    // a signature figure (SUITES[id].sig) with a weapon: the blade (the modelled one, or the far part of the long thing
    // it holds) can light up (the material) and is tracked (the swoosh)
    const sg = SUITES[id]?.sig, wh = weapon.R || weapon.L, from = sg?.bladeFrom ?? 0.35;
    // (the axis found on the held surface — the one the aims use — before the converter's blade, which can take the
    // wrong end of a spear)
    const span = wh ? [wh.userData.fist.clone().addScaledVector(wh.userData.ax, wh.userData.far * from), wh.userData.fist.clone().addScaledVector(wh.userData.ax, wh.userData.far)] : M.blade ? M.blade.map((p) => V3(...p)) : null;
    const lux = sg && span ? { a: { value: span[0] }, b: { value: span[1] }, k: { value: 0 }, t: { value: 0 }, rim: { value: 0 } } : NO_LUX;
    const hit = { value: V3() }, blink = { value: 0 }, mat = material(M, hit, blink, glow, !!fireCfg, lux);
    const mesh = new THREE.SkinnedMesh(M.geo, mat);
    mesh.frustumCulled = false; mesh.layers.set(LAYER);
    root.add(mesh);
    root.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones, inv), new THREE.Matrix4());
    // a lit model's outline (the anime look): the same skinned mesh, its back faces pushed out along the normals
    let outline = null;
    if (M.lit) {
      const om = new THREE.MeshBasicMaterial({ color: 0x3a2a1e, side: THREE.BackSide });
      om.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace("#include <skinning_vertex>", "#include <skinning_vertex>\n transformed += normalize(objectNormal) * 0.0055;").replace("#include <project_vertex>", "#include <project_vertex>\n gl_Position.z += 0.0015 * gl_Position.w;"); };   // pushed back: only the silhouette shows
      om.customProgramCacheKey = () => "ember-model-outline";
      outline = new THREE.SkinnedMesh(M.geo, om);
      outline.frustumCulled = false; outline.layers.set(LAYER); outline.visible = false;
      root.add(outline); outline.bind(mesh.skeleton, new THREE.Matrix4());
    }
    // the weapon trail's holder: the figure spec's trail runs along its prop's +y from `from` to `to`; put that frame
    // on the model's blade (bind space → the right hand's space)
    const props = [], tr = spec.moves?.attack?.trail, hand = M.joints.findIndex((j) => j.name === "RightHand");
    if (tr?.prop && hand >= 0 && M.blade) {
      const base = V3(...M.blade[0]), tip = V3(...M.blade[1]), dir = tip.clone().sub(base), k = dir.length() / (tr.to[1] - tr.from[1]);
      dir.normalize();
      const H = new THREE.Matrix4().compose(base.clone().addScaledVector(dir, -tr.from[1] * k), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir), V3(k, k, k));
      const holder = new THREE.Object3D();
      inv[hand].clone().multiply(H).decompose(holder.position, holder.quaternion, holder.scale);
      B.RightHand.add(holder);
      props.push({ grip: tr.prop, holder });
    }
    // a caster's emitter (the spec's attack.emitter bone, e.g. "orb"): the centre of what her off hand holds
    const J = {}, em = spec.moves?.attack?.emitter, hn = side === "L" ? "LeftHand" : "RightHand", hi = M.joints.findIndex((j) => j.name === hn);
    if (em?.bone && held && hi >= 0) { const o = new THREE.Object3D(); o.position.fromArray(held).applyMatrix4(inv[hi]); B[hn].add(o); J[em.bone] = o; }
    // the fireball burns where the orb was (at the held thing's centre in the hand)
    let fire = null;
    if (fireCfg && hi >= 0) { fire = EmberFire.ball({ r: fireCfg.r, layer: LAYER }); fire.obj.position.fromArray(held).applyMatrix4(inv[hi]); B[hn].add(fire.obj); }
    // the grip turns the hand about the model's side axis as it was at rest, expressed in the hand's own frame
    const gripAxis = B.RightHand ? V3(1, 0, 0).applyQuaternion(modelQ(B.RightHand, root, new THREE.Quaternion()).invert()).normalize() : null;
    const chestRest = B.Spine2 ? modelQ(B.Spine2, root, new THREE.Quaternion()) : null;
    const headRest = B.Head ? modelQ(B.Head, root, new THREE.Quaternion()) : null;
    const cols = [], uv = M.geo.attributes.uv;
    for (let i = 0; i < uv.count; i += 37) cols.push(...lin(M.data, texel(M, uv.getX(i), uv.getY(i))));
    const fig = { model: true, id, spec, kind: spec.kind, root, mesh, outline, bones: B, J, props, mats: outline ? [mat, outline.material] : [mat], geos: [], hit, blink, glow, gripAxis, M, style: M.style || STYLE[id] || "melee", side,
      rest: bones.map((b) => [b, b.quaternion.clone(), b.position.clone()]),
      vox: { bone: new Array(cols.length / 3).fill(0), color: new Float32Array(cols) }, phase: Math.random() * 6.28,
      spring: { x: 0, vx: 0, z: 0, vz: 0, prev: null, vel: null, T: null }, nextBlink: 1 + Math.random() * 3,
      bonesArr: bones, restQ: bones.map((b) => b.quaternion.clone()), hipH: B.Hips ? B.Hips.position.y : 0, fire, weapon, chestRest, headRest, spell: spellOf(id),
      bladeK: lux.k, bladeT: lux.t, rimK: lux.rim, blade: null };
    // the blade's root and point, riding the weapon hand (the swoosh is drawn between them)
    if (span && !M.beast) {                   // every model's weapon is tracked (a plain figure's swoosh too); a signature's lights up
      const hn = wh ? (weapon.R ? "RightHand" : "LeftHand") : "RightHand", hi = M.joints.findIndex((j) => j.name === hn);
      fig.blade = span.map((p) => { const o = new THREE.Object3D(); o.position.copy(p).applyMatrix4(inv[hi]); B[hn].add(o); return o; });
    }
    // its signature choreography (while it plays motion capture): the arena and EmberSkillFx cue on it
    Object.defineProperty(fig, "sig", { get: () => suiteOf(fig)?.sig || null });
    fig.keys = keysFor(fig);
    Object.defineProperty(fig, "stay", { get: () => (fig.style === "judgment" && !fig.sig) || !!fig.sig?.stay });   // the coded judgment and a god strike from where they stand
    return fig;
  }
  /** a caster's spell look (EmberFire): its colour, whether it rises round a god, the sprite's whirl, its wind-up */
  function spellOf(id) {
    const sp = SUITES[id]?.spell;
    if (!sp) return null;
    return { look: { mode: sp.fire ? "fire" : "energy", tint: sp.tint || [1, 0.5, 0.1] }, rise: !!sp.rise, spin: !!SUITES[id].spin, windup: sp.windup ?? 700, r: sp.r, bolt: sp.bolt };
  }
  /** what a hand holds, if it is long (a sword, a spear, a scythe, a scepter): the principal axis of the held surface
   *  bound to that hand (mt 255, found in bind space), pointing away from the fist toward its far end — a holder on
   *  the hand whose +Y runs along it (aimed by the suites); null for a round thing (an orb) or an empty hand */
  function weaponHolder(M, B, inv, side) {
    const hand = M.joints.findIndex((j) => j.name === side + "Hand"), mt = M.geo.attributes.aMetal?.array;
    if (hand < 0 || !mt || !B[side + "Hand"]) return null;
    const P = M.geo.attributes.position.array, J = M.geo.attributes.skinIndex.array, Wt = M.geo.attributes.skinWeight.array, pts = [];
    for (let i = 0; i < mt.length; i++) {
      if (mt[i] < 253) continue;
      let d = -1, w = -1; for (let k = 0; k < 4; k++) if (Wt[i * 4 + k] > w) { w = Wt[i * 4 + k]; d = J[i * 4 + k]; }
      if (d === hand) pts.push(V3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]));
    }
    if (pts.length < 30) return null;
    const c = pts.reduce((a, p) => a.add(p), V3()).multiplyScalar(1 / pts.length);
    let ax = V3(0.3, 1, 0.2).normalize();
    for (let it = 0; it < 24; it++) { const n = V3(); for (const p of pts) { const d = p.clone().sub(c); n.addScaledVector(d, d.dot(ax)); } ax = n.normalize(); }
    // long: its length well beyond its typical width (a rag, a crossguard or a scythe's blade stick out; the median
    // width ignores them)
    let lo = Infinity, hi = -Infinity; const wid = [];
    for (const p of pts) { const d = p.clone().sub(c), t = d.dot(ax); lo = Math.min(lo, t); hi = Math.max(hi, t); wid.push(d.addScaledVector(ax, -t).length()); }
    wid.sort((a, b) => a - b);
    if (hi - lo < 6 * wid[wid.length >> 1]) return null;                      // not long: an orb, a lantern body
    const fist = V3().setFromMatrixPosition(inv[hand].clone().invert());
    if (fist.distanceTo(c.clone().addScaledVector(ax, hi)) < fist.distanceTo(c.clone().addScaledVector(ax, lo))) ax.negate();
    const local = ax.clone().transformDirection(inv[hand]);
    const holder = new THREE.Object3D(); holder.quaternion.setFromUnitVectors(V3(0, 1, 0), local);
    let far = 0; for (const p of pts) far = Math.max(far, p.clone().sub(fist).dot(ax));
    holder.userData = { fist, ax: ax.clone(), far };                         // bind space: the fist, along the weapon, to its far end
    B[side + "Hand"].add(holder);
    return holder;
  }
  /** a bone's orientation in the model's space (the chain of its parents' and its own turns up to the figure root) */
  function modelQ(b, root, out) { out.identity(); for (let o = b; o && o !== root; o = o.parent) out.premultiply(o.quaternion); return out; }

  /** its surface in world space at the current pose (a sample of its vertices, their texture colours) — for assembling
   *  and shattering */
  function pointsWorld(fig) {
    fig.root.updateMatrixWorld(true);
    const m = fig.mesh, n = m.geometry.attributes.position.count, step = Math.max(1, Math.floor(n / 1400)), uv = m.geometry.attributes.uv;
    const pts = [], cols = [], v = V3();
    for (let i = 0; i < n; i += step) {
      m.applyBoneTransform(i, v.fromBufferAttribute(m.geometry.attributes.position, i)).applyMatrix4(m.matrixWorld);
      pts.push(v.x, v.y, v.z); cols.push(...lin(fig.M.data, texel(fig.M, uv.getX(i), uv.getY(i))));
    }
    return { pts: new Float32Array(pts), cols: new Float32Array(cols), size: 0.024 * fig.root.getWorldScale(V3()).x };
  }

  // ---- clips: bone turns about axes of the model's space, parents before children
  const X = V3(1, 0, 0), Y = V3(0, 1, 0), Z = V3(0, 0, 1), _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _t = new THREE.Quaternion();
  function turn(fig, name, axis, a) {
    const b = fig.bones[name]; if (!b || !a) return;
    modelQ(b.parent, fig.root, _p);
    _q.setFromAxisAngle(axis, a);
    b.quaternion.premultiply(_t.copy(_p).invert().multiply(_q).multiply(_p));
  }
  const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const bell = (x, a, b) => ease((x - a) / 0.5) * (1 - ease((x - b + 0.5) / 0.5));
  /** a pose: raise/fore = weapon arm (out to the side first, clear of the hair) and forearm; grip = the hand's turn from
   *  the resting point-down hold toward a forward grip (negative); twist/lean = torso; step = front-foot lunge;
   *  crouch; guard = shield raised in front; tuck = shield drawn aside */
  const K = (o = {}) => ({ raise: 0, fore: 0, grip: 0, twist: 0, lean: 0, step: 0, crouch: 0, guard: 0, tuck: 0, ...o });
  const mix = (a, b, t) => { const o = {}; for (const k in a) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  function stance(fig, k) {
    const H = fig.bones.Hips;
    if (H) { H.position.y -= 0.022 * k.crouch + 0.012 * k.step; H.position.z += 0.03 * k.step; }
    turn(fig, "RightUpLeg", X, -0.5 * k.step - 0.22 * k.crouch);
    turn(fig, "RightLeg", X, 0.3 * k.step + 0.45 * k.crouch);
    turn(fig, "RightFoot", X, -0.2 * k.crouch);
    turn(fig, "LeftUpLeg", X, 0.35 * k.step - 0.22 * k.crouch);
    turn(fig, "LeftLeg", X, 0.25 * k.step + 0.45 * k.crouch);
    turn(fig, "LeftFoot", X, -0.2 * k.crouch - 0.15 * k.step);
    turn(fig, "Spine", Y, k.twist);
    turn(fig, "Spine1", X, k.lean);
    turn(fig, "Head", X, -k.lean * 0.4);
    turn(fig, "RightArm", Z, -0.55 * Math.min(1, k.raise / 1.2));
    turn(fig, "RightArm", X, -k.raise);
    turn(fig, "RightForeArm", X, -k.fore);
    const tuck = fig.M.noTuck ? 0 : k.tuck;             // only a shield is drawn aside; an empty off hand stays down
    turn(fig, "LeftArm", Z, 0.3 * tuck + 0.12 * k.guard);
    turn(fig, "LeftArm", Y, -0.6 * k.guard);             // swung across the front about the vertical: the shield stays upright
    turn(fig, "LeftArm", X, -0.22 * k.guard);
    if (k.grip && fig.gripAxis) fig.bones.RightHand.quaternion.multiply(_q.setFromAxisAngle(fig.gripAxis, k.grip));
  }
  const REST = K(), COIL = K({ raise: 2.25, fore: 0.95, grip: -1.65, twist: -0.35, lean: -0.12, crouch: 0.6, tuck: 0.8 });
  const STRIKE = K({ raise: 0.3, fore: 0.1, grip: -1.05, twist: 0.32, lean: 0.26, step: 1, crouch: 0.3, tuck: 0.8 });
  // a thrust: the weapon drawn back at the hip, then driven straight forward on a long step
  const T_COIL = K({ raise: 0.6, fore: 1.3, twist: -0.4, lean: -0.1, crouch: 0.5, tuck: 0.6 });
  const T_STRIKE = K({ raise: 1.35, fore: 0.05, twist: 0.35, lean: 0.25, step: 1, crouch: 0.3, tuck: 0.6 });
  // where the weapon should point at each key (model space, +z forward): a chop coils the blade down behind the head
  // and lands it forward and down; a thrust points it forward throughout
  const AIM = { melee: [V3(0, -0.5, -0.85), V3(0, -0.3, 0.95)], thrust: [V3(0, 0.05, 1), V3(0, -0.1, 1)] };
  /** the figure's key poses, the hand's grip turn solved per model so its own weapon points where the key wants it */
  function keysFor(fig) {
    const [c, s] = fig.style === "thrust" ? [T_COIL, T_STRIKE] : [COIL, STRIKE], aim = AIM[fig.style === "judgment" ? "melee" : fig.style];
    const holder = fig.props[0]?.holder;
    if (!aim || !holder || !fig.gripAxis) return { coil: c, strike: s };
    const dir = V3(), solve = (k, want) => {
      let best = 0, bd = -2;
      for (let a = -Math.PI; a < Math.PI; a += 0.05) {
        for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
        stance(fig, { ...k, grip: a }); fig.root.updateMatrixWorld(true);
        dir.set(0, 1, 0).transformDirection(holder.matrixWorld);
        const d = dir.dot(want.clone().normalize()); if (d > bd) { bd = d; best = a; }
      }
      return best;
    };
    const keys = { coil: { ...c, grip: solve(c, aim[0]) }, strike: { ...s, grip: solve(s, aim[1]) } };
    // judgment: the blade straight up over her head, then cut down at the foe
    if (fig.style === "judgment") { keys.raise = { ...RAISE, grip: solve(RAISE, V3(0, 1, 0.12)) }; }
    for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
    fig.root.updateMatrixWorld(true);
    return keys;
  }
  // the hair and cape spring: stiffness, damping, radians per (unit/s²) of the chest's acceleration, limit
  const SPRING = { k: 95, d: 9, gain: 0.006, max: 0.7 };
  function spring(fig, T) {
    const s = fig.spring, chest = fig.bones.Spine2;
    if (!fig.bones.Back || !chest) return;
    const dt = s.T == null ? 0 : Math.min(0.05, T - s.T); s.T = T;
    fig.root.updateMatrixWorld(true);
    const p = chest.getWorldPosition(V3());
    if (!s.prev || dt <= 0 || p.distanceTo(s.prev) > 0.6) { s.prev = p; s.vel = V3(); }
    else {
      const v = p.clone().sub(s.prev).divideScalar(dt), a = v.clone().sub(s.vel).divideScalar(dt);
      s.prev = p; s.vel.lerp(v, 0.6);
      a.applyQuaternion(fig.root.getWorldQuaternion(_t).invert());                      // into the model's space
      const tx = Math.max(-SPRING.max, Math.min(SPRING.max, a.z * SPRING.gain)), tz = Math.max(-SPRING.max, Math.min(SPRING.max, -a.x * SPRING.gain));
      for (let i = 0, n = 4, h = dt / n; i < n; i++) {
        s.vx += (SPRING.k * (tx - s.x) - SPRING.d * s.vx) * h; s.x += s.vx * h;
        s.vz += (SPRING.k * (tz - s.z) - SPRING.d * s.vz) * h; s.z += s.vz * h;
      }
    }
    turn(fig, "Back", X, s.x + 0.02 * Math.sin(T * 1.7 + fig.phase));
    turn(fig, "Back", Z, s.z);
  }
  /** melee: a clip's stance → { done, hop, squeeze } */
  function melee(fig, clip, t) {
    let k = REST, done = true, hop = 0, squeeze = 0;
    if (clip === "attack") {
      const { hit: H, length: L } = C.timing(fig);
      const { coil: CO, strike: ST } = fig.keys;
      if (t < H * 0.72) { const u = t / (H * 0.72); k = mix(REST, CO, ease(u)); k.grip = CO.grip * ease((u - 0.3) / 0.7); }   // the blade rises along the arm, then flips back
      else if (t < H) k = mix(CO, ST, Math.pow((t - H * 0.72) / (H * 0.28), 1.6));
      else if (t < H + 0.1) k = ST;
      else k = mix(ST, REST, ease((t - H - 0.1) / Math.max(0.1, L - H - 0.1)));
      done = t < L;
    } else if (clip === "hurt") {
      const q = Math.pow(Math.max(0, 1 - t / 0.36), 2), up = ease(t / 0.05) * (1 - ease((t - 0.24) / 0.12));
      k = K({ raise: 0.25 * q, fore: 0.2 * q, twist: -0.15 * q, lean: -0.32 * q, crouch: 0.4 * q, guard: up });
      squeeze = up; done = t < 0.36;
    } else if (clip === "victory") {
      const up = ease(t / 0.25) * (1 - ease((t - 1.0) / 0.26));
      k = K({ raise: 2.9 * up, fore: 0.2 * up, lean: -0.08 * up });
      hop = 0.04 * Math.abs(Math.sin((t / 0.42) * Math.PI)) * (t < 0.84 ? 1 : 0);
      done = t < 1.26;
    }
    stance(fig, k);
    return { done, hop, squeeze };
  }
  /** judgment: she stands her ground and thrusts the greatsword straight up — the moment it is high (the contact) the
   *  sword of light slams down on her foe (the arena's attack.smite); she holds it aloft, blazing, while the light
   *  stands in the ground, then lowers it. Victory raises it point-up the same way, with a hop */
  const RAISE = K({ raise: 3.0, fore: 0.3, twist: -0.12, lean: -0.16, crouch: 0.25, guard: 0.35 });
  const DIP = K({ raise: 0.35, fore: 0.6, twist: 0.1, lean: 0.12, crouch: 0.9, guard: 0.5 });
  const JUDGE_HOLD = 1.05;
  function judgment(fig, clip, t, T) {
    const RA = fig.keys.raise;
    if (clip === "victory") {
      const up = ease(t / 0.25) * (1 - ease((t - 1.0) / 0.26));
      stance(fig, mix(REST, RA, up)); fig.glow.k.value = 0.8 * up;
      return { done: t < 1.26, hop: 0.04 * Math.abs(Math.sin((t / 0.42) * Math.PI)) * (t < 0.84 ? 1 : 0), squeeze: 0 };
    }
    if (clip !== "attack") { fig.glow.k.value = 0; return melee(fig, clip, t); }
    const { hit: H } = C.timing(fig), a = H * 0.3, down = H + JUDGE_HOLD, L = down + 0.4;
    let k, charge;
    if (t < a) { const u = ease(t / a); k = mix(REST, DIP, u); k.grip = RA.grip * 0.3 * u; charge = 0.3 * u; }    // gathers low
    else if (t < H) { const u = 1 - Math.pow(1 - (t - a) / (H - a), 2.2); k = mix({ ...DIP, grip: RA.grip * 0.3 }, RA, u); charge = 0.3 + 0.7 * u; }   // thrust up, arriving on the contact
    else if (t < down) { k = { ...RA }; const e = t - H; k.lean -= 0.08 * Math.exp(-e * 6); k.twist += 0.015 * Math.sin(T * 40) * Math.exp(-e * 3); charge = 1; }
    else { const u = ease((t - down) / 0.4); k = mix(RA, REST, u); charge = 1 - u; }
    stance(fig, k);
    fig.glow.k.value = 1.6 * charge * (0.85 + 0.15 * Math.sin(T * 18));
    return { done: t < L, hop: 0, squeeze: 0 };
  }
  /** caster: hovers  /** caster: hovers with its legs hanging, wings fluttering; attack draws the held orb back to the shoulder while it
   *  charges (glow), then thrusts it at the target on the release as the wings beat hard; hurt folds the wings back and
   *  drops her; victory is a spin in the air → { done, hop, squeeze } */
  function caster(fig, clip, t, T) {
    const H = fig.bones.Hips;
    let draw = 0, thrust = 0, lean = 0, fold = 0, beat = 0, spin = 0, up = 0, done = true, squeeze = 0, glow = 0;
    if (clip === "attack") {
      const { hit: Hh, length: L } = C.timing(fig), w = Hh * 0.75;
      if (t < w) { draw = ease(t / w); glow = draw; lean = -0.14 * draw; }
      else if (t < Hh + 0.12) { const q = ease((t - w) / (Hh - w)); draw = 1 - q; thrust = q; lean = -0.14 + 0.34 * q; beat = q; glow = 1 - 0.5 * q; }
      else { const q = ease((t - Hh - 0.12) / Math.max(0.1, L - Hh - 0.12)); thrust = 1 - q; lean = 0.2 * (1 - q); beat = 1 - q; glow = 0.5 * (1 - q); }
      done = t < L;
    } else if (clip === "hurt") {
      const q = Math.pow(Math.max(0, 1 - t / 0.4), 2);
      lean = -0.35 * q; fold = q; up = -0.05 * q; squeeze = ease(t / 0.05) * (1 - ease((t - 0.26) / 0.12)); done = t < 0.4;
    } else if (clip === "victory") {
      spin = ease(t / 0.9); up = 0.08 * Math.sin(Math.min(1, t / 0.9) * Math.PI); beat = 0.6 * (1 - ease((t - 0.9) / 0.3)); done = t < 1.2;
    }
    // a winged caster hovers with its legs hanging and its wings fluttering; one without wings stands
    const flies = !!fig.bones.WingL;
    if (flies) {
      if (H) H.position.y += 0.05 + 0.018 * Math.sin(T * 2.2 + fig.phase) + up;
      const flap = Math.sin(T * (28 + 20 * beat) + fig.phase) * (0.16 + 0.25 * beat), rest = 0.18 + 0.7 * fold - 0.35 * beat;
      turn(fig, "WingL", Y, rest + flap); turn(fig, "WingR", Y, -(rest + flap));
      turn(fig, "WingL", Z, 0.1 * flap); turn(fig, "WingR", Z, -0.1 * flap);
      const d = Math.sin(T * 1.6 + fig.phase);
      turn(fig, "LeftUpLeg", X, -0.12 + 0.06 * d); turn(fig, "LeftLeg", X, 0.35 + 0.08 * d);
      turn(fig, "RightUpLeg", X, 0.05 - 0.06 * d); turn(fig, "RightLeg", X, 0.5 - 0.08 * d);
    } else {
      stance(fig, K({ crouch: 0.35 * draw + 0.5 * fold, step: 0.6 * thrust }));
      if (H) H.position.y += up * 0.4 + 0.03 * Math.sin(Math.min(1, spin) * Math.PI);
    }
    if (spin && H) turn(fig, "Hips", Y, spin * Math.PI * 2);
    turn(fig, "Spine1", X, lean); turn(fig, "Head", X, -lean * 0.5);
    // the casting arm (the hand that holds something): drawn back beside the shoulder, then thrust forward; the other
    // arm opens out. A right-handed caster mirrors the turns
    const m = fig.side === "R" ? -1 : 1, A = fig.side === "R" ? "Right" : "Left", O = fig.side === "R" ? "Left" : "Right";
    // robed casters (wide sleeves and cloaks on the arm) cast with a smaller arm and more body
    const k = fig.M.lit ? (flies ? 1 : 0.85) : (flies ? 1 : 0.55) * (ARM[fig.id] ?? 1);   // a realistic figure's tight sleeves drag nothing
    turn(fig, "Spine", Y, m * (0.35 * draw - 0.3 * thrust) * (flies ? 1 : 1.4));
    turn(fig, A + "Arm", X, (0.9 * draw - 1.35 * thrust) * k);
    turn(fig, A + "Arm", Z, m * (0.45 * draw - 0.35 * thrust) * k);
    turn(fig, A + "ForeArm", X, (-0.5 * draw + 0.85 * thrust) * k);
    // the free arm moves only on winged casters (robed ones drag their cloaks with it)
    if (flies) { turn(fig, O + "Arm", Z, -m * (0.25 * beat + 0.3 * spin * (1 - spin) * 4)); turn(fig, O + "Arm", X, -0.3 * draw); }
    fig.glow.k.value = glow * 1.4;
    return { done, hop: 0, squeeze };
  }
  /** archer: lifts the bow (held across the body in both hands) to eye level at the target, leans into the draw, holds,
   *  and rocks back on the release */
  function archer(fig, clip, t, T) {
    if (clip !== "attack") return melee(fig, clip, t);
    const { hit: Hh, length: L } = C.timing(fig), aimT = Hh * 0.45;
    const aim = t < aimT ? ease(t / aimT) : t < Hh + 0.2 ? 1 : 1 - ease((t - Hh - 0.2) / Math.max(0.1, L - Hh - 0.2));
    const draw = t < aimT ? 0 : t < Hh ? ease((t - aimT) / (Hh - aimT)) : Math.max(0, 1 - (t - Hh) / 0.06);
    const snap = t >= Hh && t < Hh + 0.25 ? Math.sin(((t - Hh) / 0.25) * Math.PI) : 0;
    // the bow is held across the body in both hands (as the model was made): both arms lift it together to eye level,
    // the body leans into the draw and rocks back on the release
    stance(fig, K({ crouch: 0.35 * aim, step: 0.5 * aim, lean: -0.12 * draw + 0.15 * snap }));
    turn(fig, "Spine", Y, 0.25 * aim);
    turn(fig, "Head", X, -0.1 * aim);
    for (const A of ["Left", "Right"]) {
      turn(fig, A + "Arm", X, -0.95 * aim + 0.2 * snap);
      turn(fig, A + "ForeArm", X, -0.35 * aim);
    }
    turn(fig, "RightArm", Z, 0.25 * draw);                        // the string hand opens outward as it draws
    return { done: t < L, hop: 0, squeeze: 0 };
  }
  /** bow (a realistic archer, the bow in the left fist at rest): turns side-on, the bow arm straight out at the target
   *  (the wrist keeps the bow upright), the string hand drawn back to the chin with the elbow high, holds, looses
   *  (the string hand flicks back) and lowers */
  function bow(fig, clip, t, T) {
    if (clip !== "attack") return melee(fig, clip, t);
    const { hit: Hh, length: L } = C.timing(fig), aimT = Hh * 0.4;
    const aim = t < aimT ? ease(t / aimT) : t < Hh + 0.25 ? 1 : 1 - ease((t - Hh - 0.25) / Math.max(0.1, L - Hh - 0.25));
    const draw = t < aimT * 0.6 ? 0 : t < Hh ? ease((t - aimT * 0.6) / (Hh - aimT * 0.6)) : Math.max(0, 1 - (t - Hh) / 0.05);
    const snap = t >= Hh && t < Hh + 0.3 ? Math.sin(((t - Hh) / 0.3) * Math.PI) : 0;
    stance(fig, K({ crouch: 0.3 * aim, lean: -0.05 * aim + 0.08 * snap }));
    turn(fig, "Spine", Y, -0.75 * aim); turn(fig, "Spine1", Y, -0.2 * aim);
    turn(fig, "Head", Y, 0.8 * aim);
    turn(fig, "LeftArm", X, -1.5 * aim); turn(fig, "LeftArm", Y, 0.55 * aim);
    turn(fig, "LeftForeArm", X, 0.2 * aim);
    turn(fig, "LeftHand", X, 1.3 * aim);
    turn(fig, "RightArm", X, -1.45 * aim); turn(fig, "RightArm", Y, (-0.2 - 0.45 * draw) * aim);
    turn(fig, "RightForeArm", Y, (1.6 + 0.9 * draw - 0.5 * snap) * aim);
    return { done: t < L, hop: 0, squeeze: 0 };
  }
  // ---- motion-captured clips (EmberModelAnims, tools/anim_art.mjs): a figure with a suite plays them instead of its
  // coded clips. Each clip frame holds every bone's world turn away from the T-pose (D); on the figure a bone's world
  // rotation is D · its own T-pose rotation (M.tq), made local to its animated parent. Bones a clip leaves alone
  // (fingers round the fist, the hair / cape "Back", wings) keep their rest relative to their parent. Attacks run
  // faster than captured (mocap reads slow at this scale); the contact frame is the clip's, the stage times the
  // director's contact to it (C.timing below). A new clip blends in from the pose the figure was in.
  // Each figure's suite is chosen for who it is (docs/design/MINIATURES.md): its weapon, its bearing, its temper.
  //   aimUp: in that clip the weapon's point turns to the sky as the weapon hand rises above the head (a clip made
  //   for an open hand holds a blade flat) · aim: { clip: [x, y, z] } the point held that way (figure space) all
  //   through the clip · hover: it floats, legs hanging, wings beating · speed: × the clip speeds (a mountain is slow)
  //   Clips ending in _m are Mixamo's mirror (the caster works with the left hand, where its focus is)
  //   aim: { clip: "up" | "target" | "raised" | [x, y, z] } where the weapon points (see aimFor) · lower: clips whose
  //   legs are the idle's (a kneel, a leap or the splits would not suit the figure) · face: the chest turns to the foe
  //   as the blow lands (casting clips turn aside) · upright: clips whose back, neck and head are the idle's too (a
  //   caster stands tall and casts with the arms; a god never stoops) · float: a god hovers that high · spin: a
  //   sprite whirls as it gathers · spell: its charge and bolt (EmberFire): tint or fire, rise (a column of light
  //   round a god), windup (ms of charging before the release), bolt (its size) · stance: the clip upright/lower take the
  //   body from (else the idle; with it the idle itself can be upright: its arms, the stance's body) · bow: an archer
  //   turns so the arrow (string hand → bow hand) points at the foe
  //   sig: a signature choreography, authored pose to pose the way a MOBA champion's moves are (the capture is the
  //   reference, the timing is drawn): see SIG below
  const SUITES = {
    // 圣光裁决者 — the signature: upright and composed at rest, saluting with the blade now and then; the attack is a
    // spinning leap behind her shield that slams the blade down on the foe and lands her on one knee as the light
    // cracks out of the ground, then she rises; she takes a blow on the shield, braced; the holy sword raised high on
    // victory
    paladin: { idle: "st_axe", attack: "ss_power", hurt: "ss_impact", victory: "vc_raise_hand", aim: { victory: "raised" },
      sig: {
        lead: 600, windup: 340,                                          // ms to the blow; how much longer than the director's plain lunge
        // before the blow: [share of the lead, clip frame, ease into it] — a slow coil behind the shield, a beat held
        // at its bottom, the spring up turning (fast off the ground, hanging at the top), the blade down in ~4 frames
        pre: [[0, 0], [0.22, 11, "io"], [0.3, 12.5, "o"], [0.8, 28, "o"], [1, 33, "i3"]],
        // after it (seconds): the landing driven into the kneel, held while the light cracks out
        post: [[0, 33], [0.1, 37, "o"], [0.36, 41, "io"]],
        rise: 0.34, back: 0.32,                                          // up off the knee to the stance; the hop back to her station
        leap: 0.3,                                                       // the share of the lead when her feet leave the ground
        reach: 0.42,                                                     // where she lands short of the foe (× her size): the blade's length
        hitstop: [0, 3, 5, 7],                                           // frames the blow holds her, by tier (heavier than a plain hit)
        dash: "leap",                                                    // leap: even through the air · lunge: late and fast
        // at rest, every 9–14 s: the knight's salute (the blade raised before her face), held, lowered
        flourish: { clip: "gs_pose", every: [9, 14], keys: [[0, 0], [0.85, 30, "io"], [2.3, 58, "io"]], fade: [0.35, 0.55] },
        // its effects (EmberSkillFx): holy gold; a sun sigil; the ground cracks; feathers of light; the shield flares
        fx: { pal: "holy", sigil: "sun", ground: "crack", bits: "feather", hurt: "shield", aura: { bits: "sparkle" } },
      },
      plain: { attack: "gs_downward_slash", hurt: "gs_impact" } },       // what the signature replaced (the model demo compares)
    // the sun god: his sun blade planted point-down before him; he leaps up with it overhead — kept on his feet, a
    // god's overhead judgment, slow — and raises it to the sky
    aurion: { idle: "st_idle", attack: "mg_cast_forward", hurt: "gs_impact", victory: "vc_raise_hand", aim: { idle: [0, -1, 0.35], attack: "target", victory: "raised" }, upright: ["attack", "victory"], speed: 0.85, float: 0.04,
      // 日轮万剑: a god does not swing. Risen a hand's breadth, he draws the sun blade back as a wheel of blades forms
      // behind him, one by one, facing the world; they turn on his foe, he levels the sword at it, and they are loosed
      // in quick succession — lines of light, each marking its cut — the last of them the judgment: a great crossed cut
      sig: { lead: 700, windup: 440, pre: [[0, 0], [0.45, 6, "io"], [0.58, 7, "o"], [0.74, 17, "i3"], [1, 22, "l"]], post: [[0, 22], [0.3, 26, "io"], [0.6, 32, "io"]],
        rise: 0.45, back: 0, stay: true, levitate: 0.12, hitstop: [0, 3, 4, 5],
        fx: { pal: "dawn", sigil: "sun", cast: "array", blades: 12, modern: true, dim: 0.7, slash: false, trail: false, hurt: "body", scale: 1.1, shake: 1.2, victory: { orb: "sun" }, aura: { bits: "sparkle", every: 300 } } },
      plain: { attack: "gs_jump_atk", aim: { idle: [0, -1, 0.35], victory: "raised" }, float: 0 } },
    // the frost king admires his own blade; one sweeping slash that ends on the blow; a cold salute
    frostking: { idle: "gs_admire", attack: "gs_power_slash", hurt: "gs_impact", victory: "gs_pose",
      // 凛冬斩: the blade swung far back as rime climbs it, one wide cut — the ground freezes over and ice bursts from it
      sig: { lead: 580, windup: 320, pre: [[0, 0], [0.35, 10, "io"], [0.62, 18, "o"], [0.72, 19, "o"], [1, 23, "i3"]], post: [[0, 23], [0.1, 26, "o"], [0.3, 29, "io"]],
        rise: 0.3, back: 0.3, leap: 0.55, dash: "lunge", reach: 0.45, hitstop: [0, 3, 5, 7],
        fx: { pal: "frost", sigil: "rune", ground: "frost", spikes: "ice", bits: "shard", bits2: "snow", beam: false, chargeShape: "snow", hurt: "body", victory: { rain: "snow" }, aura: { bits: "snow", every: 500 } } },
      plain: {} },
    // the dark-moon reaper: prowling guard, a low reaping sweep in both hands, the scythe raised to the sky
    reaper: { idle: "gs_look", attack: "gs_low", hurt: "gs_impact", victory: "vc_raise_hand", aim: { idle: "up", victory: "raised" },
      // 月蚀收割: a long low reap under a dark moon; the crescent it leaves, the victim's life drawn back into him in wisps
      sig: { lead: 540, windup: 280, pre: [[0, 0], [0.5, 12, "io"], [0.62, 13, "o"], [1, 25, "i3"]], post: [[0, 25], [0.12, 30, "o"], [0.34, 36, "io"]],
        rise: 0.3, back: 0.3, leap: 0.5, dash: "lunge", reach: 0.5, hitstop: [0, 3, 5, 7], bladeFrom: 0.6,
        fx: { pal: "moon", sigil: "moon", slash: "crescent", ground: "void", bits: "wisp", drain: true, beam: false, trailInner: 0.55, hurt: "body", victory: { ray: false, orb: "moon", rain: "wisp" }, aura: { bits: "wisp", every: 600 } } },
      plain: {} },
    // sword and shield: the squire cheers with his sword up; the sun-chaser swift and bright; the rookie pumps his fist
    // with the sword high; the moon knight stands tall behind his shield, strikes without leaving the ground, salutes
    squire: { idle: "ss_idle", attack: "ss_high_attack", hurt: "ss_impact", victory: "mg_cheer", aim: { victory: "raised" },
      // 晨曦斩: a squire's clean overhead cut behind a raised shield, the dawn's light on the blade
      sig: { lead: 460, windup: 200, pre: [[0, 0], [0.55, 13, "io"], [0.66, 14, "o"], [1, 20, "i3"]], post: [[0, 20], [0.1, 23, "o"], [0.34, 28, "io"]],
        rise: 0.28, back: 0.28, leap: 0.5, dash: "lunge", reach: 0.4, hitstop: [0, 3, 4, 6],
        fx: { pal: "holy", sigil: "sun", beam: false, scale: 0.85, hurt: "shield", victory: { rain: "sparkle" }, aura: { bits: "sparkle", every: 900, halo: false } } },
      plain: {} },
    solaris: { idle: "ss_idle", attack: "ss_cross_slash", hurt: "ss_impact", victory: "vc_raise_hand", aim: { victory: "raised" },
      // 逐日十字斩: in on the foe in two strokes — the second one fast and burning — a cross of sunfire left on it, a
      // flare of flame, the ground scorched
      sig: { lead: 500, windup: 240, pre: [[0, 0], [0.2, 6, "io"], [0.5, 17, "o"], [0.62, 18.5, "o"], [1, 25, "i3"]], post: [[0, 25], [0.1, 29, "o"], [0.34, 36, "io"]],
        rise: 0.3, back: 0.3, leap: 0.4, dash: "lunge", reach: 0.4, hitstop: [0, 3, 5, 7],
        fx: { pal: "sun", sigil: "sun", slash: "cross", ground: "crack", flame: true, beam: false, trailFrom: 0.15, hurt: "shield", victory: { orb: "sun" }, aura: { bits: "sparkle", every: 380 } } },
      plain: {} },
    recruit: { idle: "ss_look", attack: "ss_down", hurt: "ss_impact", victory: "vc_pump", aim: { victory: "raised" },
      // 新兵劈砍: the rookie's eager chop, a flash of first light
      sig: { lead: 460, windup: 200, pre: [[0, 0], [0.55, 13, "io"], [0.7, 14, "o"], [1, 19, "i3"]], post: [[0, 19], [0.12, 22, "o"], [0.34, 28, "io"]],
        rise: 0.28, back: 0.28, leap: 0.5, dash: "lunge", reach: 0.4, hitstop: [0, 3, 4, 6],
        fx: { pal: "dawn", sigil: "sun", beam: false, scale: 0.85, hurt: "shield", victory: { rain: "sparkle" }, aura: { bits: "sparkle", every: 900, halo: false } } },
      plain: {} },
    moonguard: { idle: "st_axe", attack: "ss_down", hurt: "ss_blocked", victory: "gs_pose", lower: ["attack"], speed: 0.92,
      // 星盾镇击: the lamp-keeper gathers starlight behind his shield and brings the blade down; a star sigil is struck
      // into the ground, stars scatter; blows ring off his star shield
      sig: { lead: 560, windup: 300, pre: [[0, 0], [0.55, 13, "io"], [0.7, 14, "o"], [1, 19, "i3"]], post: [[0, 19], [0.12, 22, "o"], [0.34, 28, "io"]],
        rise: 0.3, back: 0.3, leap: 0.5, dash: "lunge", reach: 0.42, hitstop: [0, 4, 6, 8],
        fx: { pal: "star", sigil: "star", ground: "rune", bits: "star", hurt: "shield", shake: 1.2, victory: { orb: "star", rain: "star" }, aura: { bits: "sparkle" } } },
      plain: { attack: "ss_power" } },
    // spears: upright at rest and on victory, driven point-first at the foe
    guard: { idle: "st_axe", attack: "sp_bayonet", hurt: "ss_blocked", victory: "vc_raise_hand", aim: { idle: "up", attack: "target", victory: "raised" },
      // 铁誓突刺: the iron-sworn guard's disciplined thrust, steel ringing
      sig: { lead: 480, windup: 220, pre: [[0, 0], [0.5, 17, "io"], [0.6, 17.5, "o"], [1, 28, "i3"]], post: [[0, 28], [0.1, 31, "o"], [0.3, 36, "io"]],
        rise: 0.28, back: 0.3, leap: 0.45, dash: "lunge", reach: 0.55, hitstop: [0, 3, 5, 6], bladeFrom: 0.7,
        fx: { pal: "steel", sigil: "rune", slash: "pierce", beam: false, trailFrom: 0.6, trailInner: 0.6, hurt: "shield", victory: { rain: "sparkle" }, aura: { bits: "sparkle", every: 900, halo: false } } },
      plain: {} },
    huntress: { idle: "ax_look", attack: "sp_bayonet", hurt: "bw_hit_front", victory: "ax_battlecry", aim: { idle: "up", attack: "target", victory: "up" },
      // 穿林突刺: she charges and drives the spear through — a streak of wind out the far side, leaves torn loose
      sig: { lead: 460, windup: 200, pre: [[0, 0], [0.5, 17, "io"], [0.6, 17.5, "o"], [1, 28, "i3"]], post: [[0, 28], [0.1, 31, "o"], [0.3, 36, "io"]],
        rise: 0.28, back: 0.3, leap: 0.45, dash: "lunge", reach: 0.55, hitstop: [0, 3, 4, 6], bladeFrom: 0.7,
        fx: { pal: "wild", sigil: "leaf", slash: "pierce", bits: "leaf", beam: false, trailFrom: 0.6, trailInner: 0.6, hurt: "body", victory: { ray: false, rain: "leaf" }, aura: { bits: "leaf", every: 700, halo: false } } },
      plain: {} },
    skeleton: { idle: "zb_idle", attack: "sp_bayonet", hurt: "zb_stumble", victory: "zb_alert", aim: { idle: "up", attack: "target", victory: "up" },
      // 骸骨突刺: a lurching jab in a haze of grave-light, bone chips flying
      sig: { lead: 440, windup: 180, pre: [[0, 0], [0.5, 17, "io"], [0.6, 17.5, "o"], [1, 28, "i3"]], post: [[0, 28], [0.1, 31, "o"], [0.3, 36, "io"]],
        rise: 0.28, back: 0.3, leap: 0.45, dash: "lunge", reach: 0.55, hitstop: [0, 3, 4, 6], bladeFrom: 0.7,
        fx: { pal: "bone", sigil: "rune", slash: "pierce", bits: "shard", nbits: 5, beam: false, trailFrom: 0.6, trailInner: 0.6, hurt: "body", victory: { ray: false, rain: "wisp" }, aura: { bits: "wisp", every: 800, halo: false } } },
      plain: {} },
    fenlos: { idle: "st_axe", attack: "sp_torch", hurt: "bw_hit_front", victory: "vc_raise_hand", aim: { idle: "up", attack: "target", victory: "raised" }, upright: ["attack"],
      // 荒猎神矛: the hunt god does not run at his prey. Leaves climb round him as he draws back and levels the spear;
      // a lance of the wild's light leaves its point and runs the prey through, and the wild answers — roots split the
      // ground and thorns burst up round it
      sig: { lead: 580, windup: 320, pre: [[0, 0], [0.55, 19, "io"], [0.66, 20, "o"], [1, 25, "i3"]], post: [[0, 25], [0.15, 28, "o"], [0.4, 33, "io"]],
        rise: 0.35, back: 0, stay: true, hitstop: [0, 3, 4, 5], bladeFrom: 0.7,
        fx: { pal: "verdant", sigil: "leaf", rise: true, riseShape: "leaf", cast: "spear", modern: true, dim: 0.5, trail: false, hurt: "body", scale: 1.1, shake: 1.2, victory: { rain: "leaf" }, aura: { bits: "leaf", every: 500 } } },
      plain: {} },
    // the assassin: knife in a reverse grip, a stab from the rear hand, then the blade sheathed
    assassin: { idle: "kn_idle", attack: "kn_stab", hurt: "mu_hit", victory: "kn_sheath",
      // 影袭: she sinks into shadow, poised, darts in and stabs — a crimson line across the foe, smoke where she was
      sig: { lead: 440, windup: 180, pre: [[0, 0], [0.3, 8, "o"], [0.62, 19, "io"], [0.72, 21, "o"], [1, 30, "i3"]], post: [[0, 30], [0.1, 33, "o"], [0.3, 38, "io"]],
        rise: 0.26, back: 0.26, leap: 0.6, dash: "lunge", reach: 0.3, hitstop: [0, 3, 4, 6],
        fx: { pal: "shadow", sigil: false, vanish: true, bits: "wisp", nbits: 5, beam: false, trailFrom: 0.7, trailInner: 0.3, hurt: "body", victory: { ray: false, rain: "wisp" }, aura: { bits: "wisp", every: 1100, halo: false } } },
      plain: {} },
    // the red-rock berserker: crouched and restless, an overhead chop, a battle cry
    berserker: { idle: "ax_crouch", attack: "ax_down", hurt: "ax_gut", victory: "ax_battlecry",
      // 狂怒劈斩: the axe hauled up with a roar and brought down; the rock splits red-hot, stones jump
      sig: { lead: 520, windup: 260, pre: [[0, 0], [0.55, 17, "io"], [0.66, 18.5, "o"], [1, 25, "i3"]], post: [[0, 25], [0.12, 28, "o"], [0.34, 34, "io"]],
        rise: 0.3, back: 0.3, leap: 0.45, dash: "lunge", reach: 0.42, hitstop: [0, 4, 6, 8],
        fx: { pal: "rage", sigil: false, ground: "crack", rocks: 5, beam: false, shake: 1.3, hurt: "body", victory: { ray: false, shock: true, rain: "sparkle" }, aura: { bits: "sparkle", every: 700, halo: false } } },
      plain: {} },
    // the archer: the bow held ready, drawn to the cheek facing the foe, loosed
    vesper: { idle: "bw_aim_idle", attack: "bw_aimfire", hurt: "bw_hit_front", victory: "vc_pump_restrained", bow: true,
      // 逐风之矢: wind gathers on the drawn arrow; it leaves with a crack and runs the foe through
      sig: { lead: 390, pre: [[0, 0], [0.7, 5, "io"], [0.85, 5.5, "o"], [1, 7, "i3"]], post: [[0, 7], [0.2, 12, "o"], [0.5, 20, "io"]], rise: 0.3, back: 0,
        fx: { pal: "wild", sigil: "leaf", cast: "bolt", slash: "pierce", bits: "leaf", nbits: 5, beam: false, trail: false, hurt: "body", victory: { ray: false, rain: "leaf" }, aura: { bits: "leaf", every: 900, halo: false } } },
      plain: {} },
    // casters, their bodies to the foe as the spell leaves, on their feet
    spark: { idle: "mg_idle", attack: "mg_cast_forward", hurt: "mg_hit_right", victory: "mg_cheer", upright: ["attack"], face: true, spell: { fire: true },
      // 火花弹: the apprentice's fireball, fed until it roars, flung — it bursts and scorches
      sig: { lead: 790, pre: [[0, 0], [0.7, 20, "io"], [0.8, 22, "o"], [1, 24, "i3"]], post: [[0, 24], [0.15, 28, "o"], [0.45, 36, "io"]], rise: 0.35, back: 0,
        fx: { pal: "fire", sigil: "sun", cast: "bolt", flame: true, ground: "crack", slash: false, weapon: false, scale: 0.8, hurt: "body", victory: { ray: false, flame: true }, aura: { bits: "sparkle", every: 500, halo: false } } },
      plain: {} },
    jingchen: { idle: "st_idle", attack: "cs_upwards", hurt: "mg_hit_right", victory: "cs_upwards", upright: ["attack", "victory"], face: true, float: 0.05, spell: { fire: true, rise: true, windup: 850, bolt: 0.11 },
      // 焚天炎柱: the star-flame god throws nothing. The ground under his foe is marked — a crisp ring filling as he lifts
      // the fire in his hand to the sky — and as he raises it, a vortex of fire tears up out of the ground, tossing the
      // foe; black smoke rolls from its foot, the ground left molten; it burns out from the top
      sig: { lead: 940, pre: [[0, 0], [0.5, 11, "io"], [0.66, 13, "o"], [0.85, 18, "o"], [1, 20, "l"]], post: [[0, 20], [0.3, 24, "io"], [0.6, 30, "io"]], rise: 0.45, back: 0,
        fx: { pal: "fire", sigil: "sun", cast: "pillar", modern: true, dim: 0.65, lift: 0.3, slash: false, weapon: false, hurt: "body", scale: 1.1, shake: 1.3, victory: { ray: false, orb: "sun", flame: true }, aura: { bits: "sparkle", every: 350 } } },
      plain: { attack: "mg_conjure_throw" } },
    cleric: { idle: "pr_sway", attack: "cs_two_fwd", hurt: "mg_hit_right", victory: "mg_heal", upright: ["attack", "victory"], face: true, spell: { tint: [1.5, 1.15, 0.45] },
      // 曙光圣击: a prayer gathered in both hands and sent; light comes down where it strikes, feathers of it
      sig: { lead: 790, pre: [[0, 0], [0.66, 27, "io"], [0.78, 29, "o"], [1, 34, "i3"]], post: [[0, 34], [0.12, 37, "o"], [0.4, 44, "io"]], rise: 0.4, back: 0,
        fx: { pal: "holy", sigil: "sun", cast: "bolt", ground: "rune", bits: "feather", nbits: 5, slash: false, weapon: false, scale: 0.9, hurt: "body", victory: { ray: false, rain: "feather" }, aura: { bits: "sparkle", every: 600 } } },
      plain: {} },
    // the necromancer holds his lantern out before him, calls the dead up from the ground, and lifts the lantern high
    necromancer: { idle: "mg_idle", attack: "mg_ground@m", hurt: "mg_hit_right", victory: "vc_raise_hand", upright: ["attack"], face: true, spell: { tint: [0.35, 1.3, 0.7] }, keep: { attack: "Right" }, castSide: "L",
      // 亡魂之手: the lantern (right) is held steady and burns brighter as the dead answer; his free hand calls down
      // into the ground — a circle opens under his foe and the dead rise out of it in a column
      sig: { lead: 790, pre: [[0, 0], [0.68, 26, "io"], [0.8, 28, "o"], [1, 31, "i3"]], post: [[0, 31], [0.12, 34, "o"], [0.4, 42, "io"]], rise: 0.4, back: 0,
        fx: { pal: "necro", sigil: "rune", cast: "ground", lantern: true, castHand: "LeftHand", ground: "void", bits: "wisp", slash: false, weapon: false, hurt: "body", victory: { ray: false, rain: "wisp" }, aura: { bits: "wisp", every: 600 } } },
      plain: { attack: "mg_ground", keep: null, castSide: null, spell: { tint: [0.55, 0.2, 1.1] } } },
    // the ferryman leads with his lantern (left): the soul-light is cast from it, and on victory the lantern is raised
    soulguide: { idle: "st_suitcase_m", attack: "cs_one", hurt: "mg_hit_right", victory: "vc_raise_hand_m", upright: ["attack"], face: true, spell: { tint: [0.45, 0.95, 1.4] }, keep: { attack: "Left" }, castSide: "R",
      // 渡魂之光: the lantern (left) stays steady and brightens as the souls' light gathers; the free hand sends it
      sig: { lead: 790, pre: [[0, 0], [0.68, 21, "io"], [0.78, 23, "o"], [1, 26, "i3"]], post: [[0, 26], [0.15, 30, "o"], [0.45, 38, "io"]], rise: 0.4, back: 0,
        fx: { pal: "soul", sigil: "moon", cast: "bolt", lantern: true, castHand: "RightHand", bits: "wisp", slash: false, weapon: false, hurt: "body", victory: { ray: false, rain: "wisp" }, aura: { bits: "wisp", every: 700 } } },
      plain: { attack: "cs_one_m", keep: null, castSide: null } },
    // the stargazer, standing, sweeps the sky with her astrolabe and holds it up to the stars
    oracle: { idle: "st_look", attack: "mg_sweep_m", hurt: "mg_hit_right", victory: "vc_raise_hand_m", upright: ["attack"], face: true, spell: { tint: [0.6, 0.8, 1.7] },
      // 星轨: the astrolabe swept across the sky, a star plucked from it and sent; a star sigil where it lands
      sig: { lead: 790, pre: [[0, 0], [0.66, 24, "io"], [0.78, 26, "o"], [1, 29, "i3"]], post: [[0, 29], [0.12, 32, "o"], [0.4, 38, "io"]], rise: 0.4, back: 0,
        fx: { pal: "star", sigil: "star", cast: "bolt", ground: "rune", bits: "star", nbits: 5, slash: false, weapon: false, hurt: "body", victory: { ray: false, orb: "star", rain: "star" }, aura: { bits: "star5", every: 700 } } },
      plain: {} },
    // the star-fallen queen: scepter upright, raised to call the stars down, raised again in triumph
    nyx: { idle: "st_idle2", attack: "cs_upwards_m", hurt: "mg_hit_right", victory: "vc_raise_hand_m", aim: { idle: "up", attack: "up", victory: "up" }, upright: ["attack", "victory"], face: true, float: 0.03, spell: { tint: [1.1, 0.45, 1.6], rise: true, windup: 800 },
      // 星陨: she raises the scepter, a star sigil opens under her foe and three stars fall on it, the last on the blow
      sig: { lead: 890, pre: [[0, 0], [0.62, 12, "io"], [0.76, 14, "o"], [1, 19, "i3"]], post: [[0, 19], [0.12, 22, "o"], [0.4, 30, "io"]], rise: 0.4, back: 0,
        fx: { pal: "astral", sigil: "star", cast: "sky", ground: "rune", bits: "star", slash: false, trail: false, look: { mode: "energy", tint: [1.1, 0.45, 1.6] }, hurt: "body", victory: { orb: "star", rain: "star" }, aura: { bits: "star5", every: 450 } } },
      plain: {} },
    // the dark-moon goddess: the orb held before her, its power pulled in and blasted out standing, arms spread wide
    selmyra: { idle: "mg_idle", stance: "st_idle", attack: "mg_blast", hurt: "mg_hit_right", victory: "pr_arms_up", upright: ["idle", "attack", "victory"], face: true, float: 0.05, spell: { tint: [0.75, 0.25, 1.4], rise: true, windup: 850, bolt: 0.1 },
      // 月蚀坍缩: the dark-moon goddess draws the dark in with both hands, three crescents wheeling round her; before her
      // foe the air tears open and a black hole swells in the rift, pulling the light in; she thrusts her hands out and
      // it collapses to a point — and bursts: a black ring, crescents cutting outward, a pool of dark
      sig: { lead: 940, pre: [[0, 0], [0.55, 20, "io"], [0.8, 24, "o"], [1, 30, "i3"]], post: [[0, 30], [0.12, 33, "o"], [0.45, 40, "io"]], rise: 0.4, back: 0,
        fx: { pal: "void", sigil: "moon", cast: "collapse", modern: true, dim: 0.75, lift: 0.12, slash: false, beam: false, weapon: false, hurt: "body", scale: 1.1, shake: 1.2, victory: { ray: false, orb: "moon", rain: "wisp" }, aura: { bits: "wisp", every: 500 } } },
      plain: { attack: "mg_blast" } },
    // the blood-moon walker casts left-handed and exults, arms spread to the sky
    leech: { idle: "st_idle2", attack: "cs_one_m", hurt: "mg_hit_right", victory: "pr_arms_up", upright: ["attack"], face: true, spell: { tint: [1.5, 0.08, 0.15] },
      // 血月汲取: a bolt of blood-moon light; the wound's life runs back to her in red wisps
      sig: { lead: 790, pre: [[0, 0], [0.66, 22, "io"], [0.78, 23.5, "o"], [1, 27, "i3"]], post: [[0, 27], [0.15, 31, "o"], [0.45, 38, "io"]], rise: 0.4, back: 0,
        fx: { pal: "blood", sigil: "moon", cast: "bolt", drain: true, bits: "wisp", nbits: 5, slash: false, weapon: false, hurt: "body", victory: { ray: false, orb: "moon", rain: "wisp" }, aura: { bits: "wisp", every: 700 } } },
      plain: {} },
    // the twilight sprite floats on her wings
    wisp: { idle: "mg_idle_m", attack: "cs_two_fwd", hurt: "mg_hit_right", victory: "pr_arms_up", hover: 0.3, spin: true, face: true, spell: { tint: [0.45, 1.6, 0.8], windup: 750 },
      // 暮光花雨: she whirls in the air, petals of light round her, and sends a mote of dusk; it bursts in petals
      sig: { lead: 840, pre: [[0, 0], [0.6, 24, "io"], [0.74, 26, "o"], [1, 31, "i3"]], post: [[0, 31], [0.12, 34, "o"], [0.4, 40, "io"]], rise: 0.4, back: 0,
        fx: { pal: "fey", sigil: "leaf", cast: "bolt", bits: "leaf", nbits: 8, slash: false, weapon: false, hurt: "body", victory: { ray: false, rain: "leaf" }, aura: { bits: "sparkle", every: 400 } } },
      plain: {} },
    // the ember-wing scout: a fighter's bounce, a flying kick, a boxer's win
    sentinel: { idle: "fi_bounce", attack: "kk_bicycle", hurt: "mu_hit", victory: "vc_boxing",
      // 烬翼飞踢: a leaping kick trailing embers; it lands in a burst of flame
      sig: { lead: 460, windup: 200, pre: [[0, 0], [0.6, 5, "io"], [0.7, 5.5, "o"], [1, 8, "i3"]], post: [[0, 8], [0.12, 12, "o"], [0.4, 19, "io"]],
        rise: 0.28, back: 0.3, leap: 0.45, dash: "leap", reach: 0.32, hitstop: [0, 3, 5, 6],
        fx: { pal: "ember", sigil: false, limb: ["RightLeg", "RightToeBase"], trailFrom: 0.55, trailInner: 0.2, flame: true, ground: "crack", slash: false, beam: false, scale: 0.85, hurt: "body", victory: { ray: false, flame: true }, aura: { bits: "sparkle", every: 600, halo: false } } },
      plain: {} },
    // stone, iron, bark and mountain: the golem swipes; the titan throws a straight cross and pounds his chest; the
    // treant lashes a branch-arm across, rooted; the mountain brings both fists down from overhead, slowly
    golem: { idle: "mu_idle", attack: "mu_swipe", hurt: "mu_hit", victory: "mu_roar",
      // 符文横扫: the runes on the stone wake one by one, a heavy swipe — the ground cracks blue, stones burst up
      sig: { lead: 560, windup: 300, pre: [[0, 0], [0.6, 22, "io"], [0.72, 24, "o"], [1, 30, "i3"]], post: [[0, 30], [0.12, 33, "o"], [0.4, 40, "io"]],
        rise: 0.35, back: 0.35, leap: 0.5, dash: "lunge", reach: 0.4, hitstop: [0, 4, 6, 8],
        fx: { pal: "rune", sigil: "rune", limb: ["LeftForeArm", "LeftHand"], trailFrom: 0.72, trailInner: 0.2, ground: "crack", spikes: "rock", rocks: 5, slash: false, beam: false, weapon: false, shake: 1.3, scale: 1.1, hurt: "body", victory: { ray: false, shock: true, rain: "rock" }, aura: { bits: "sparkle", every: 900, halo: false } } },
      plain: {} },
    titan: { idle: "mu_idle", attack: "pu_cross", hurt: "mu_hit", victory: "ax_chest", speed: 0.9,
      // 玄铁重拳: the iron titan winds up and throws a straight cross — sparks and a ringing shock
      sig: { lead: 500, windup: 240, pre: [[0, 0], [0.55, 4, "io"], [0.68, 4.5, "o"], [1, 8, "i3"]], post: [[0, 8], [0.1, 10, "o"], [0.35, 18, "io"]],
        rise: 0.3, back: 0.32, leap: 0.5, dash: "lunge", reach: 0.4, hitstop: [0, 4, 6, 8],
        fx: { pal: "iron", sigil: false, limb: ["RightForeArm", "RightHand"], trailFrom: 0.55, trailInner: 0.2, slash: false, beam: false, weapon: false, shake: 1.4, scale: 1.15, hurt: "body", victory: { ray: false, shock: true }, aura: { bits: "sparkle", every: 1000, halo: false } } },
      plain: {} },
    treant: { idle: "mu_idle", attack: "zb_swipe", hurt: "mu_hit", victory: "mu_roar", lower: ["attack"], speed: 0.9,
      // 古木鞭挞: the old tree draws its branch-arm back and lashes; roots split the ground, thorns spring up, leaves fall
      sig: { lead: 560, windup: 300, pre: [[0, 0], [0.4, 13, "io"], [0.66, 26, "o"], [1, 31, "i3"]], post: [[0, 31], [0.15, 36, "o"], [0.42, 42, "io"]],
        rise: 0.35, back: 0.35, leap: 0.5, dash: "lunge", reach: 0.42, hitstop: [0, 4, 6, 8],
        fx: { pal: "verdant", sigil: "leaf", limb: ["RightForeArm", "RightHand"], trailFrom: 0.7, trailInner: 0.2, ground: "roots", spikes: "thorn", bits: "leaf", beam: false, weapon: false, shake: 1.2, scale: 1.1, hurt: "body", victory: { ray: false, rain: "leaf" }, aura: { bits: "leaf", every: 800, halo: false } } },
      plain: {} },
    colossus: { idle: "mu_idle", attack: "mu_jump_attack", hurt: "mu_hit", victory: "mu_roar", speed: 0.8,
      // 山崩: the mountain crouches, heaves itself into the air and comes down fists first — the ground breaks, stone
      // spikes burst up, boulders fly, the dust rolls out; a long hold on the blow
      sig: { lead: 700, windup: 440, pre: [[0, 0], [0.25, 12, "io"], [0.33, 13.5, "o"], [0.68, 29, "o"], [0.76, 32, "l"], [1, 50, "i3"]], post: [[0, 50], [0.15, 55, "o"], [0.45, 66, "io"]],
        rise: 0.45, back: 0.4, leap: 0.33, dash: "leap", reach: 0.4, hitstop: [0, 5, 7, 9], hipScale: 0.35,
        fx: { pal: "earth", sigil: "rune", ground: "crack", spikes: "rock", rocks: 10, slash: false, beam: false, dust: 2, weapon: false, trail: false, hurt: "body", scale: 1.3, shake: 1.8, victory: { ray: false, rain: "rock", shock: true }, aura: { bits: "sparkle", every: 900, halo: false } } },
      plain: { lower: ["attack"] } },
  };
  const SPEED = { attack: 1.35, hurt: 1.2, victory: 1.1, idle: 1 }, BLEND = 0.18, BLEND_IDLE = 0.5;
  const clips = new Map();
  function clipData(name) {
    if (clips.has(name)) return clips.get(name);
    const A = typeof EmberModelAnims !== "undefined" && EmberModelAnims[name];
    let out = null;
    // "<clip>@m": the clip mirrored left for right (a lantern-bearer casts with the free hand): each side's bones take
    // the other side's turns reflected through the body's midplane (x, y, z, w → x, −y, −z, w), the hips' sway reversed
    if (name.endsWith("@m")) {
      const B = clipData(name.slice(0, -2));
      if (B) {
        const q = Float32Array.from(B.q), hip = Float32Array.from(B.hip);
        for (let i = 0; i < q.length; i += 4) { q[i + 1] = -q[i + 1]; q[i + 2] = -q[i + 2]; }
        for (let i = 0; i < hip.length; i += 3) hip[i] = -hip[i];
        out = { ...B, q, hip, bones: B.bones.map((n) => (/^Left/.test(n) ? n.replace(/^Left/, "Right") : n.replace(/^Right/, "Left"))) };
      }
    } else if (A) {
      const raw = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0)).buffer;
      const q = new Int16Array(raw(A.q)), hp = new Int16Array(raw(A.hip));
      out = { n: A.n, fps: A.fps, bones: A.bones, loop: !!A.loop, hit: A.hit, q: Float32Array.from(q, (v) => v / 32767), hip: Float32Array.from(hp, (v) => v / 10000) };
    }
    clips.set(name, out);
    return out;
  }
  const MOCAP = { on: true, sig: true };       // the model demo switches back to the coded clips (or a signature to its plain suite) to compare
  const plainOf = (s) => s.plainSuite || (s.plainSuite = { ...s, ...s.plain, sig: null });
  const suiteOf = (fig) => { const s = MOCAP.on && fig.M.tq && !fig.M.beast && SUITES[fig.id]; return !s ? null : s.sig && !MOCAP.sig ? plainOf(s) : s; };
  /** the clip's timing on the figure (seconds): contact and length, played at SPEED (a signature: its lead, then the
   *  landing, the rise and the hop home) */
  function clipTiming(fig) {
    const sg = fig.sig;
    if (sg) { const H = sg.lead / 1000; return { hit: H, length: H + sg.post[sg.post.length - 1][0] + sg.rise + sg.back }; }
    const A = clipData(suiteOf(fig).attack), k = SPEED.attack * (suiteOf(fig).speed ?? 1);
    return { hit: (A.hit ?? A.n * 0.45) / A.fps / k, length: (A.n - 1) / A.fps / k };
  }
  // the eases a signature's keys name: io in-out · o out (fast, then settling) · i3 in (slow, then fast: a strike)
  const EASES = { io: ease, o: (x) => 1 - (1 - x) * (1 - x), o3: (x) => 1 - Math.pow(1 - x, 3), i3: (x) => x * x * x, l: (x) => x };
  /** keys [[x, frame, ease], …] → the clip frame at x */
  function keyed(keys, x) {
    if (x <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (x <= keys[i][0]) { const [x0, f0] = keys[i - 1], [x1, f1, e] = keys[i]; return f0 + (f1 - f0) * (EASES[e] || EASES.l)((x - x0) / (x1 - x0)); }
    return keys[keys.length - 1][1];
  }
  const _a = new THREE.Quaternion(), _b = new THREE.Quaternion(), _w = new THREE.Quaternion();
  /** frame: play that frame of the clip (a signature's re-timed keys) instead of the clip's own clock */
  function playClip(fig, clip, name, t, T, frame = null) {
    const A = clipData(name); if (!A) return null;
    const k = (SPEED[clip] ?? 1) * (suiteOf(fig)?.speed ?? 1), last = A.n - 1;
    let u = frame != null ? Math.min(last, Math.max(0, frame)) : clip === "idle" ? ((T + fig.phase * 3) * A.fps) % last : Math.min(last, t * A.fps * k);
    const f0 = Math.floor(u), f1 = Math.min(last, f0 + 1), fr = u - f0;
    // per bone: the clip's world turn for this frame
    if (!fig.clipIdx || fig.clipIdx.name !== name) fig.clipIdx = { name, of: A.bones.map((nm) => fig.M.joints.findIndex((j) => j.name === nm)) };
    const W = fig.worldQ || (fig.worldQ = fig.M.joints.map(() => new THREE.Quaternion()));
    const D = new Array(fig.M.joints.length).fill(null);
    fig.clipIdx.of.forEach((ji, k2) => {
      if (ji < 0 || !fig.M.tq[ji]) return;
      const o0 = (f0 * A.bones.length + k2) * 4, o1 = (f1 * A.bones.length + k2) * 4;
      _a.set(A.q[o0], A.q[o0 + 1], A.q[o0 + 2], A.q[o0 + 3]); _b.set(A.q[o1], A.q[o1 + 1], A.q[o1 + 2], A.q[o1 + 3]);
      D[ji] = _a.clone().slerp(_b, fr);
    });
    fig.bonesArr.forEach((b, i) => {
      const p = fig.M.joints[i].parent, pw = p >= 0 ? W[p] : _w.identity();
      if (D[i]) W[i].copy(D[i]).multiply(_a.fromArray(fig.M.tq[i]));
      else W[i].copy(pw).multiply(fig.restQ[i]);
      b.quaternion.copy(p >= 0 ? W[p] : _b.identity()).invert().multiply(W[i]);
    });
    // the hips rise and sink with the clip; they do not travel (the stage moves the figure)
    const H = fig.bones.Hips;
    if (H) { const o0 = f0 * 3, o1 = f1 * 3, dy = A.hip[o0 + 1] + (A.hip[o1 + 1] - A.hip[o0 + 1]) * fr; H.position.y += dy * fig.hipH * (clip === "attack" ? suiteOf(fig)?.sig?.hipScale ?? 1 : 1); }
    const done = clip === "idle" || u < last || (clip === "victory" && t < 1.6);      // a victory pose is held a while
    if (fig.style === "judgment" && clip === "attack" && A.hit != null && !fig.sig) { const h = A.hit; fig.glow.k.value = 1.6 * (u < h ? ease(u / h) : Math.max(0, 1 - (u - h) / (A.fps * 0.5))); }
    else fig.glow.k.value = 0;
    return done;
  }
  /** a signature attack: its clip played through its keys — the lead (t ≤ H, which the arena stretches onto the
   *  director's contact), then the landing in real seconds — then risen into the idle stance (fast off the knee,
   *  settling), which it keeps for the hop home → false once it is home */
  function sigAttack(fig, suite, t, T) {
    const sg = suite.sig, H = sg.lead / 1000, P = sg.post[sg.post.length - 1][0];
    if (t <= H + P) { playClip(fig, "attack", suite.attack, t, T, t <= H ? keyed(sg.pre, t / H) : keyed(sg.post, t - H)); return true; }
    playClip(fig, "attack", suite.attack, t, T, sg.post[sg.post.length - 1][1]);
    blendOver(fig, () => playClip(fig, "idle", suite.idle, 0, T), EASES.o3(Math.min(1, (t - H - P) / sg.rise)));
    return t < H + P + sg.rise + sg.back;
  }
  /** a signature at rest: its idle, and every so often its flourish (a salute, a taunt, a roar) blended over it */
  function sigIdle(fig, suite, t, T) {
    playClip(fig, "idle", suite.idle, t, T);
    const sa = suite.sig.flourish; if (!sa) return true;
    const D = sa.keys[sa.keys.length - 1][0];
    if (fig.flourish == null || T < fig.flourish - 60) fig.flourish = T + sa.every[0] * 0.5 + Math.random() * 3;     // a new figure waits a while first
    const s = T - fig.flourish;
    if (s > D) fig.flourish = T + sa.every[0] + Math.random() * (sa.every[1] - sa.every[0]);
    else if (s >= 0) blendOver(fig, () => playClip(fig, "idle", sa.clip, s, T, keyed(sa.keys, s)), ease(s / sa.fade[0]) * (1 - ease((s - D + sa.fade[1]) / sa.fade[1])));
    return true;
  }
  /** the pose the bones hold now, moved toward the pose `play` makes by w (the hips' height too) */
  function blendOver(fig, play, w) {
    if (w <= 0) return;
    const from = fig.bonesArr.map((b) => b.quaternion.clone()), hy = fig.bones.Hips?.position.y;
    for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
    play();
    if (w >= 1) return;
    fig.bonesArr.forEach((b, i) => { _w.copy(b.quaternion); b.quaternion.copy(from[i]).slerp(_w, w); });
    if (hy != null) fig.bones.Hips.position.y += (hy - fig.bones.Hips.position.y) * (1 - w);
  }
  /** the weapon's point turned to the sky, as much as the weapon hand is raised above the head (a clip made for an
   *  open hand holds a blade flat) */
  const _v = V3(), _u = V3(), _h = V3();
  function aimUp(fig) {
    const side = fig.weapon.R ? "R" : "L", hand = fig.bones[side === "R" ? "RightHand" : "LeftHand"], head = fig.bones.Head;
    if (!hand || !head) return;
    fig.root.updateMatrixWorld(true);
    const s = fig.root.getWorldScale(_h).y || 1;
    const w = ease((hand.getWorldPosition(_v).y - head.getWorldPosition(_u).y) / s / 0.12);
    if (w > 0) aimBlade(fig, V3(0.08, 1, 0.12), w, side);
  }
  /** turn the weapon hand so the weapon's point goes along dir (figure space), by w */
  function aimBlade(fig, dir, w, side = fig.weapon.R ? "R" : "L") {
    const S = side === "R" ? "Right" : "Left", hand = fig.bones[S + "Hand"], fore = fig.bones[S + "ForeArm"], holder = fig.weapon[side] || (side === "R" ? fig.props[0]?.holder : null);
    if (!hand || !holder || w <= 0) return;
    fig.root.updateMatrixWorld(true);
    const want = dir.clone().normalize().applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion()));
    const cur = V3(0, 1, 0).transformDirection(holder.matrixWorld);
    // the roll of the forearm (about its own axis) that brings the weapon nearest the aim, sparing the wrist — then the
    // wrist's bend for what is left, no more than a wrist bends (wristCare shares the roll out along the forearm)
    let q = new THREE.Quaternion().setFromUnitVectors(cur, want);
    if (fore) {
      const f = hand.getWorldPosition(V3()).sub(fore.getWorldPosition(V3())).normalize(), r = new THREE.Quaternion(), c = V3();
      let best = 0, bd = Infinity;
      for (let a = -1.9; a <= 1.9; a += 0.1) { c.copy(cur).applyQuaternion(r.setFromAxisAngle(f, a)); const d = c.angleTo(want) + 0.25 * Math.abs(a); if (d < bd) { bd = d; best = a; } }
      const roll = new THREE.Quaternion().setFromAxisAngle(f, best), rolled = cur.clone().applyQuaternion(roll);
      const bend = new THREE.Quaternion().setFromUnitVectors(rolled, want), ang = rolled.angleTo(want);
      if (ang > WRIST.swing) bend.slerp(new THREE.Quaternion(), 1 - WRIST.swing / ang).normalize();   // (slerp toward identity by the excess)
      q = bend.multiply(roll);
    }
    const qi = new THREE.Quaternion().slerp(q, Math.min(1, w));
    const hw = hand.getWorldQuaternion(new THREE.Quaternion()), pw = hand.parent.getWorldQuaternion(new THREE.Quaternion());
    hand.quaternion.copy(pw.invert().multiply(qi.multiply(hw)));
  }
  /** hands kept anatomical (after everything else has posed them), the hand's place in the world — and so what it
   *  holds, and where that points — unchanged: a wrist bends no further than a wrist can (the rest of the bend is taken
   *  at the shoulder, which turns the whole arm), and a hand does not twist against its forearm — the forearm rolls —
   *  so most of any twist a clip, an aim or a retarget put at the wrist goes up the forearm (the skin twists along the
   *  arm instead of wringing at the wrist) */
  const WRIST = { swing: 1.05, twist: 0.6, share: 0.65, on: true };
  const _pw = new THREE.Quaternion(), _fw = new THREE.Quaternion(), _g = new THREE.Quaternion(), _x = new THREE.Quaternion();
  const _e = new THREE.Quaternion(), _tw = new THREE.Quaternion(), _sw = new THREE.Quaternion(), _tf = new THREE.Quaternion(), _th = new THREE.Quaternion(), _ri = new THREE.Quaternion(), _ax = V3();
  function wristCare(fig) {
    if (!WRIST.on) return;
    fig.handIdx ||= { Left: fig.bonesArr.indexOf(fig.bones.LeftHand), Right: fig.bonesArr.indexOf(fig.bones.RightHand) };
    for (const S of ["Left", "Right"]) {
      const H = fig.bones[S + "Hand"], F = fig.bones[S + "ForeArm"], i = fig.handIdx[S];
      if (!H || !F || i < 0) continue;
      const R = fig.restQ[i];
      _e.copy(H.quaternion).multiply(_ri.copy(R).invert());                    // H = e · R: the hand's turn off its rest, in the forearm's frame
      _ax.copy(H.position).normalize();                                        // the forearm's own axis (toward the wrist)
      const d = _ax.x * _e.x + _ax.y * _e.y + _ax.z * _e.z;
      _tw.set(_ax.x * d, _ax.y * d, _ax.z * d, _e.w);
      if (_tw.lengthSq() < 1e-10) _tw.identity(); else _tw.normalize();
      _sw.copy(_e).multiply(_ri.copy(_tw).invert());                           // e = swing · twist
      const ang = 2 * Math.acos(Math.min(1, Math.abs(_sw.w))), A = fig.bones[S + "Arm"];
      if (ang > WRIST.swing && A) {
        // the excess, turned in the world at the shoulder: g = Fw · x · Fw⁻¹ (x the excess in the forearm's frame)
        _x.identity().slerp(_sw, 1 - WRIST.swing / ang);
        _sw.copy(_x).invert().multiply(_ri.copy(_e).multiply(_th.copy(_tw).invert()));       // the swing kept (x⁻¹ · swing)
        modelQ(F, fig.root, _fw); _g.copy(_fw).multiply(_x).multiply(_ri.copy(_fw).invert());
        modelQ(A.parent, fig.root, _pw);
        A.quaternion.premultiply(_ri.copy(_pw).invert().multiply(_g).multiply(_pw));
      }
      let th = 2 * Math.atan2(_ax.x * _tw.x + _ax.y * _tw.y + _ax.z * _tw.z, _tw.w);
      th = Math.atan2(Math.sin(th), Math.cos(th));
      // the wrist keeps a little of the twist (never more than it can), the forearm rolls the rest
      const wr = Math.max(-WRIST.twist, Math.min(WRIST.twist, th * (1 - WRIST.share)));
      _tf.setFromAxisAngle(_ax, th - wr); _th.setFromAxisAngle(_ax, wr);
      F.quaternion.multiply(_tf);
      H.quaternion.copy(_ri.copy(_tf).invert()).multiply(_sw).multiply(_tf).multiply(_th).multiply(R);
    }
  }
  // the suite's aim for a clip: "up" (point to the sky) · "target" (at the foe, from the wind-up through the blow) ·
  // "raised" (to the sky as the weapon hand rises above the head) · [x, y, z] (held that way in figure space)
  const POINT = { up: V3(0.05, 1, 0.1), target: V3(0, -0.08, 1) };
  function aimFor(fig, suite, clip, t) {
    const a = suite.aim?.[clip] ?? (suite.aimUp === clip ? "raised" : null);
    if (!a) return;
    if (a === "raised") return aimUp(fig);
    // strike: the blade driven down into the ground on the blow, held there through the landing, lifted with the rise
    if (a === "strike") {
      const h = C.timing(fig).hit, sg = suite.sig, P = sg ? sg.post[sg.post.length - 1][0] : 0.3, r = sg?.rise ?? 0.3;
      return aimBlade(fig, V3(0, -0.85, 0.5), t < h * 0.85 ? 0 : t < h ? ease((t - h * 0.85) / (h * 0.15)) : t < h + P ? 1 : 1 - ease((t - h - P) / r));
    }
    if (a === "target") {
      const h = C.timing(fig).hit, w = t < h ? ease((t - h * 0.4) / (h * 0.6)) : 1 - ease((t - h - 0.3) / 0.35);
      return aimBlade(fig, POINT.target, w);
    }
    aimBlade(fig, Array.isArray(a) ? V3(...a) : POINT[a], 1);
  }
  const LOWER = /^(Hips|LeftUpLeg|LeftLeg|LeftFoot|LeftToeBase|RightUpLeg|RightLeg|RightFoot|RightToeBase)$/;
  const UPRIGHT = /^(Hips|LeftUpLeg|LeftLeg|LeftFoot|LeftToeBase|RightUpLeg|RightLeg|RightFoot|RightToeBase|Spine|Spine1|Spine2|Neck|Head)$/;
  // keep: { clip: "Left" | "Right" } — that arm as the stance holds it (what it carries stays steady)
  const ARMS = { Left: /^Left(Shoulder|Arm|ForeArm|Hand)$/, Right: /^Right(Shoulder|Arm|ForeArm|Hand)$/ };
  /** the legs and hips (and with UPRIGHT the back, neck and head) as the idle has them: a clip's kneel, leap, splits
   *  or stoop would not suit the figure; its arms still do what the clip does */
  function lowerFromIdle(fig, suite, t, T, LOWER) {
    for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
    playClip(fig, "idle", suite.stance || suite.idle, 0, T);
    const keep = fig.bonesArr.map((b) => (LOWER.test(b.name) ? b.quaternion.clone() : null)), hy = fig.bones.Hips?.position.y;
    return () => { fig.bonesArr.forEach((b, i) => keep[i] && b.quaternion.copy(keep[i])); if (hy != null) fig.bones.Hips.position.y = hy; };
  }
  /** the attack's envelope for turning to the foe: in over the wind-up (a sprite's after its whirl), held through
   *  the contact, out after */
  function toFoe(fig, suite, t) {
    const h = C.timing(fig).hit, a = suite.spin ? h * 0.8 : 0;
    return Math.min(ease((t - a) / Math.max(0.12, (h - a) * 0.6)), 1 - ease((t - h - 0.3) / 0.4));
  }
  const yawOf = (v) => Math.atan2(v.x, v.z);
  /** turn the whole body (about the hips) so the line that carries the attack points at the foe (+z): an archer's
   *  arrow (string hand → bow hand), a caster's casting arm (shoulder → hand; a hand raised straight up says little,
   *  then the chest), anyone else's chest */
  function faceTarget(fig, suite, t) {
    const w = toFoe(fig, suite, t);
    if (w <= 0 || !fig.bones.Hips) return;
    fig.root.updateMatrixWorld(true);
    const P = (n) => fig.bones[n].getWorldPosition(V3()), inv = fig.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    let line = null, arm = null;
    const chest = fig.chestRest && fig.bones.Spine2 ? V3(0, 0, 1).applyQuaternion(fig.chestRest.clone().invert()).applyQuaternion(modelQ(fig.bones.Spine2, fig.root, new THREE.Quaternion())) : null;
    if (suite.bow && fig.bones.LeftHand) line = P("LeftHand").sub(P("RightHand"));          // an archer stands side-on
    else if (fig.spec.moves?.attack?.ranged) { const S = (suite.castSide || fig.side) === "L" ? "Left" : "Right"; if (fig.bones[S + "Hand"]) { line = P(S + "Hand").sub(P(S + "Arm")); arm = S + "Arm"; } }
    if (line) { line.applyQuaternion(inv); if (Math.hypot(line.x, line.z) < 0.35 * line.length()) { line = null; arm = null; } }
    if (!line) line = chest;
    if (!line) return;
    const l = yawOf(line);
    if (!arm || !chest) { turn(fig, "Hips", Y, -l * w); return; }
    // a caster turns its body only so far (its chest within 35° of the foe); the casting arm swings the rest at the
    // shoulder, so it casts at the foe without turning its back
    const c = yawOf(chest), body = Math.max(c - 0.61, Math.min(c + 0.61, l));
    turn(fig, "Hips", Y, -body * w);
    turn(fig, arm, Y, -(l - body) * w);
  }
  /** the eyes on the foe: neck and head turned (up to ~70°) so the face points at +z */
  function lookAtFoe(fig, suite, t) {
    const w = toFoe(fig, suite, t);
    if (w <= 0 || !fig.headRest || !fig.bones.Head) return;
    fig.root.updateMatrixWorld(true);
    const f = V3(0, 0, 1).applyQuaternion(fig.headRest.clone().invert()).applyQuaternion(modelQ(fig.bones.Head, fig.root, new THREE.Quaternion()));
    const e = Math.max(-1.2, Math.min(1.2, yawOf(f))) * w;
    turn(fig, "Neck", Y, -0.4 * e); turn(fig, "Head", Y, -0.6 * e);
  }
  /** a winged figure floats: the hips lifted and bobbing, the legs hanging loose (whatever the clip's feet did), the
   *  wings beating — faster as it casts */
  function hover(fig, clip, t, T) {
    const H = fig.bones.Hips; if (!H) return;
    const beat = clip === "attack" ? 1 : 0;
    H.position.y += fig.hipH * ((typeof fig.suite?.hover === "number" ? fig.suite.hover : 0.07) + 0.025 * Math.sin(T * 2.2 + fig.phase));
    fig.bonesArr.forEach((b, i) => { if (/UpLeg$|Leg$|Foot$|ToeBase$/.test(b.name)) b.quaternion.copy(fig.restQ[i]); });
    const d = Math.sin(T * 1.6 + fig.phase);
    turn(fig, "LeftUpLeg", X, -0.12 + 0.06 * d); turn(fig, "LeftLeg", X, 0.35 + 0.08 * d);
    turn(fig, "RightUpLeg", X, 0.05 - 0.06 * d); turn(fig, "RightLeg", X, 0.5 - 0.08 * d);
    const flap = Math.sin(T * (28 + 20 * beat) + fig.phase) * (0.16 + 0.25 * beat), rest = 0.18 - 0.35 * beat;
    turn(fig, "WingL", Y, rest + flap); turn(fig, "WingR", Y, -(rest + flap));
  }
  /** the held fireball: it swells as the cast gathers, is gone from the release (it flies) and re-forms in the hand */
  function fireStep(fig, clip, t, T) {
    if (!fig.fire) return;
    let k = 1;
    if (clip === "attack") { const h = C.timing(fig).hit; k = t < h ? 1 + 0.5 * ease(t / h) : t < h + 0.45 ? 0 : ease((t - h - 0.45) / 0.35); }
    fig.fire.update(T, k);
  }
  /** clip ∈ idle | attack | hurt | victory | rest; t = seconds into the clip, T = global time → false once it ended */
  function pose(fig, clip, t, T) {
    const suite = suiteOf(fig);
    if (suite && suite[clip]) {
      // remember the pose the figure leaves, to blend the new clip in from it
      const key = clip + ":" + suite[clip];
      if (fig.clipKey !== key || t < (fig.clipT ?? 0)) { fig.snap = fig.bonesArr.map((b) => b.quaternion.clone()); fig.snapHip = fig.bones.Hips?.position.y; fig.clipKey = key; fig.clipStart = T; }
      fig.clipT = t;
      if (fig.outline) fig.outline.visible = SHADE.value === 3;
      const RX = [clip === "idle" && !suite.stance ? null : suite.upright?.includes(clip) ? UPRIGHT : suite.lower?.includes(clip) ? LOWER : null, suite.keep?.[clip] ? ARMS[suite.keep[clip]] : null].filter(Boolean);
      const legs = RX.length ? lowerFromIdle(fig, suite, t, T, RX.length > 1 ? new RegExp(RX.map((r) => r.source).join("|")) : RX[0]) : null;
      for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
      const sig = suite.sig && fig.sig;
      const done = sig && clip === "attack" ? sigAttack(fig, suite, t, T) : sig && clip === "idle" ? sigIdle(fig, suite, t, T) : playClip(fig, clip, suite[clip], t, T);
      legs?.();
      if (clip === "attack" && (suite.face || suite.bow)) faceTarget(fig, suite, t);
      const w = ease((T - fig.clipStart) / (clip === "idle" ? BLEND_IDLE : BLEND));
      // (the target is taken before the bone is reset to the snapshot: slerp from where it was toward where the clip is)
      if (w < 1 && fig.snap) { fig.bonesArr.forEach((b, i) => { _w.copy(b.quaternion); b.quaternion.copy(fig.snap[i]).slerp(_w, w); }); if (fig.bones.Hips && fig.snapHip != null) fig.bones.Hips.position.y += (fig.snapHip - fig.bones.Hips.position.y) * (1 - w); }
      fig.suite = suite;
      if (suite.hover) hover(fig, clip, t, T);
      // a god stands a hand's breadth above the ground, rising and settling slowly (its idle stance kept)
      if (suite.float && fig.bones.Hips) fig.bones.Hips.position.y += fig.hipH * (suite.float + 0.012 * Math.sin(T * 1.3 + fig.phase));
      // a sprite whirls once round as it gathers its spell
      if (suite.spin && clip === "attack") { const h = C.timing(fig).hit; turn(fig, "Hips", Y, Math.PI * 2 * ease(t / (h * 0.8))); }
      aimFor(fig, suite, clip, t);
      if (clip === "attack" && !sig) lookAtFoe(fig, suite, t);          // (a signature's spin keeps its own head)
      wristCare(fig);
      spring(fig, T);
      if (T > fig.nextBlink + 0.14) fig.nextBlink = T + 2 + Math.random() * 3;
      fig.blink.value = T >= fig.nextBlink ? Math.sin(Math.min(1, (T - fig.nextBlink) / 0.14) * Math.PI) : 0;
      fireStep(fig, clip, t, T);
      fig.root.updateMatrixWorld(true);
      return done;
    }
    if (fig.outline) fig.outline.visible = SHADE.value === 3;
    for (const [b, q, p] of fig.rest) { b.quaternion.copy(q); b.position.copy(p); }
    if (clip === "rest") { fig.blink.value = 0; fig.glow.k.value = 0; fig.root.updateMatrixWorld(true); return true; }
    if (!/^(idle|attack|hurt|victory)$/.test(clip)) return false;
    const br = Math.sin(T * 2.4 + fig.phase), sway = Math.sin(T * 0.7 + fig.phase);
    const { done, hop, squeeze } = fig.style === "caster" ? caster(fig, clip, t, T) : fig.style === "archer" ? archer(fig, clip, t, T) : fig.style === "judgment" ? judgment(fig, clip, t, T) : fig.style === "bow" ? bow(fig, clip, t, T) : melee(fig, clip, t);
    // breathing and weight shift under every clip; at rest she glances down (at her blade) every few seconds
    turn(fig, "Spine1", X, 0.022 * br);
    turn(fig, "Spine", Y, 0.03 * sway);
    turn(fig, "Spine", Z, 0.025 * sway);
    turn(fig, "Head", X, -0.02 * br);
    turn(fig, "RightArm", X, -0.04 * br);
    turn(fig, "LeftArm", X, 0.03 * br);
    if (clip === "idle") { const g = bell((T + fig.phase * 2) % 9, 6, 8); turn(fig, "Head", Y, -0.32 * g); turn(fig, "Head", X, 0.16 * g); }
    if (fig.bones.Hips) { fig.bones.Hips.position.y += hop - 0.004 * (1 - br); fig.bones.Hips.position.x += 0.008 * sway; }
    spring(fig, T);
    // blinks: every 2–5 s, 0.14 s long; squeezed shut when hit
    if (T > fig.nextBlink + 0.14) fig.nextBlink = T + 2 + Math.random() * 3;
    const bl = T >= fig.nextBlink ? Math.sin(Math.min(1, (T - fig.nextBlink) / 0.14) * Math.PI) : 0;
    fig.blink.value = Math.max(bl, 0.85 * squeeze);
    fireStep(fig, clip, t, T);
    fig.root.updateMatrixWorld(true);
    return done;
  }

  // plug into the figure renderer and clips (after EmberSpriteFigures): model ids build here
  const base = { build: R.build, cached: R.cached, dispose: R.dispose, setHit: R.setHit, setEmit: R.setEmit, setFace: R.setFace, setPixelRatio: R.setPixelRatio, voxelsWorld: R.voxelsWorld, pose: C.pose };
  R.cached = (id) => (has(id) ? READY : base.cached(id));
  R.build = (id, o) => (has(id) ? build(id) : base.build(id, o));
  R.dispose = (fig) => { if (!fig.model) return base.dispose(fig); for (const m of fig.mats) m.dispose(); fig.mesh.skeleton.dispose(); fig.fire?.dispose(); };
  R.setHit = (fig, r, g, b) => (fig.model ? fig.hit.value.set(r, g, b) : base.setHit(fig, r, g, b));
  R.setEmit = (fig, k) => (fig.model ? undefined : base.setEmit(fig, k));
  R.setFace = (fig, e) => (fig.model ? undefined : base.setFace(fig, e));
  R.setPixelRatio = (fig, pr) => (fig.model ? undefined : base.setPixelRatio(fig, pr));
  R.voxelsWorld = (fig) => (fig.model ? pointsWorld(fig) : base.voxelsWorld(fig));
  const baseTiming = C.timing;
  C.timing = (fig) => (fig.model && !fig.beast && suiteOf(fig)?.attack && clipData(suiteOf(fig).attack) ? clipTiming(fig) : baseTiming(fig));
  C.pose = (fig, clip, t, T) => {
    if (!fig.model) return base.pose(fig, clip, t, T);
    if (!fig.beast) return pose(fig, clip, t, T);
    fig.outline.visible = SHADE.value === 3;
    const r = base.pose(fig, clip, t, T);             // the voxel figure's own clips, on the same bones
    fig.root.updateMatrixWorld(true);
    return r;
  };

  return Object.freeze({ has, ids: () => [...models.keys()], on, LAYER, onReady: (fn) => onReady.add(fn), setShade: (k) => { SHADE.value = k; }, setMocap: (on) => { MOCAP.on = !!on; }, setSig: (on) => { MOCAP.sig = !!on; }, setWrist: (on) => { WRIST.on = !!on; }, setSuite: (id, clip, name) => { (SUITES[id] ||= {})[clip] = name; }, suite: (id) => ({ ...SUITES[id] }), mocap: (id) => !!SUITES[id], shade: () => SHADE.value, eyes: (id) => { const e = models.get(id)?.eyes; return e ? [e.a, e.b] : null; } });
})();
