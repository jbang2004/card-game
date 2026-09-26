/* EmberVoxelArena — how battlefield figures behave, independent of any page (docs/design/MINIATURES.md).
 * A unit stands at a point on the ground, bakes on first use, assembles from its voxels, idles, attacks (a melee
 * figure dashes to its target on the director's timeline — lift → contact → release → back — a shooter shoots from
 * where it stands), takes hits (1 frame white-hot, a decaying wash, recoil, the attacker's hitstop) and dies
 * (launched, then shattered into its own voxels, which bounce once and sink). The hit-feel that belongs to the
 * figures — weapon trail and contact burst — is drawn here, in the same 3D space as the figures.
 *
 * The page owns the renderer and camera and says where things stand (the battlefield: presentation/voxel/stage.js;
 * the character gallery uses the same arena, so it shows exactly what the battle shows):
 *   const arena = EmberVoxelArena.create(scene, {
 *     size,                  board size of a figure (× its spec.scale)
 *     scaleOf(unit),         × a figure's board size (the battlefield: fitted to its token's station)
 *     base(unit),            → { r, state, ring?, tint? } — the station it stands on: a halo of radius r on the ground
 *                            that tells its state (state: { ready, taunt, frozen, shield, target }); ring = a hero's
 *                            dais halo in its dais's tint; null = none (the gallery)
 *     baseLayer,             camera layer for those halos (drawn under the figures; default: fxLayer)
 *     where(ref),            → ground point (Vector3) of { side, uid } — any unit, figure or not; null = unknown
 *     live(unit, on),        a figure took over / left its unit (the battlefield dims the token art)
 *     pixelRatio(),          for the figures' pixel dither
 *     shots,                 true = the arena flies shooters' projectiles itself (the gallery; in battle EmberFx2 does)
 *     bake(id),              → Promise of the figure's bake made off the main thread (EmberVoxelBaker.bake)
 *     ready(),               false while baking in the page would hurt (the battlefield: a sequence plays)
 *     warm(root),            compile a new figure's shaders off the frame (→ Promise); it appears once they are ready
 *     wake(),                something started that needs frames
 *     fxLayer,               camera layer for the hit-feel effects (default: the scene's layer 0)
 *   });
 *   arena.set(side, uid, figureId, info) · drop(side, uid, animate) · each(fn) · cue · contact · owns · plan
 *   arena.step(now, camera) → true while anything moves · setPixelRatio(dpr) · diagnostics()
 * Rules state is never read; a figure never changes the game. */
const EmberVoxelArena = (() => {
  const THREE = EmberVesperThree, R = EmberVoxelRender, C = EmberVoxelClips, KIT = EmberVoxelKit;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const FPS = 60, ASSEMBLE = 33, S = 0.54;
  // where a melee figure stops before its target: its weapon's reach (× its size) plus the target's half-width
  const REACH = { spear: 0.5, bite: 0.24, gore: 0.32 }, REACH_DEFAULT = 0.3;
  // victim glow colours (× strength; HOT = 1 + white emissive on the contact frame) and per-tier numbers
  const HOT = [1.55, 1.53, 1.5], TINT = { 1: [1.0, 0.6, 0.12], 2: [1.0, 0.4, 0.07], 3: [1.0, 0.25, 0.12] };
  const TIER = { 1: { freeze: 0, star: 0.36, needles: 12, spd: 15 }, 2: { freeze: 3, star: 0.42, needles: 14, spd: 17 }, 3: { freeze: 5, star: 0.44, needles: 16, spd: 20 } };
  const key = (side, uid) => side + ":" + uid;
  const hex3 = (h, k) => { const c = new THREE.Color(h); return [c.r * k, c.g * k, c.b * k]; };

  /* The station a unit stands on is light, not stone: a shader disc on the ground at full resolution, drawn under
   * every figure (the page's base layer: under the pixel pass, figures and effects over it). Unit radius; the page
   * scales it to its station. Its colour and strength ease toward its state's; a state never pops on or off.
   *   · a minion's (style 1): a soft round shadow under its feet and a faint ring in its side's colour; can act green,
   *     aimed at red (pulsing), frozen ice, divine shield gold; taunt adds a second, outer ring (a ward)
   *   · a hero's (style 0; its dais is the scene's, radius = the dais's top): a crisp ring with its bloom, the floor
   *     inside lit toward it, fine ticks turning between it and a hairline, faint in its dais's colour at rest; when
   *     the hero can act, is aimed at or frozen it takes the state's colour and two bright arcs run round it */
  const HALO_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const HALO_FS = /* glsl */ `
    uniform float uK, uAct, uT, uStyle, uTaunt, uShade; uniform vec3 uTint, uHot; varying vec2 vUv;
    float band(float d, float w, float aa) { return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x) / 6.2831853 + 0.5;
      float aa = max(fwidth(r), 1e-4), px = length(fwidth(p)) / max(r, 1e-3) / 6.2831853;
      vec3 c; float shade = 0.0;
      if (uStyle > 0.5) {
        // (in display space, straight: a faint glow must stay faint — encoding lifts small values several times over)
        const float R = 0.66, W = 0.8;
        float line = band(r - R, 0.0045 + 0.0025 * uTaunt, aa) * 0.75;
        float bloom = exp(-abs(r - R) * 12.0) * 0.26 + exp(-abs(r - R) * 4.0) * 0.05;
        float inner = pow(smoothstep(0.12, R, r), 3.0) * (1.0 - smoothstep(R, R + 0.02, r)) * 0.07;
        float ward = uTaunt * (band(r - W, 0.004, aa) * 0.7 + exp(-abs(r - W) * 18.0) * 0.2
          + 0.06 * smoothstep(R, W, r) * (1.0 - smoothstep(W - 0.01, W + 0.01, r)));
        c = uTint * (line + bloom + inner + ward);
        shade = uShade * pow(1.0 - smoothstep(0.0, 0.62, r), 1.6);
        float fade = 1.0 - smoothstep(0.93, 1.0, r);
        gl_FragColor = vec4(c * uK * fade, shade * fade);
        return;
      } else {
        const float R = 0.84;
        float line = band(r - R, 0.0065, aa);
        float hair = band(r - 0.935, 0.0022, aa) * 0.55;
        float bloom = exp(-abs(r - R) * 17.0) * 0.5 + exp(-abs(r - R) * 5.5) * 0.1;
        float fill = pow(smoothstep(0.1, R, r), 2.0) * (1.0 - smoothstep(R, R + 0.015, r)) * 0.1;
        float tu = a * 96.0 + uT * 0.8, tw = 96.0 * px;             // 96 ticks, every 12th a long one
        float tick = (1.0 - smoothstep(0.1 - tw, 0.1 + tw, abs(fract(tu) - 0.5))) * band(r - 0.89, 0.016, aa);
        float big = (1.0 - smoothstep(0.012 - tw / 12.0, 0.012 + tw / 12.0, abs(fract((tu - 0.5) / 12.0) - 0.5))) * band(r - 0.892, 0.028, aa);
        float s = fract(a * 2.0 - uT * 0.32), comet = pow(s, 5.0) * (1.0 - smoothstep(0.975, 1.0, s));
        float arc = comet * (band(r - R, 0.011, aa) + exp(-abs(r - R) * 26.0) * 0.7);
        c = uTint * (line + hair + bloom + fill + tick * 0.32 + big * 0.5) + uHot * arc * uAct;
      }
      float fade = 1.0 - smoothstep(0.93, 1.0, r);
      vec4 o = linearToOutputTexel(vec4(c * uK * fade, 0.0)); o.a = shade * fade;
      gl_FragColor = o;                                   // premultiplied: its light added, its shadow over the ground
    }`;
  const HALO = {
    hero: { ready: [[0.42, 1.0, 0.52], [0.95, 1.0, 0.78]], target: [[1.0, 0.34, 0.2], [1.0, 0.82, 0.62]], frozen: [[0.5, 0.84, 1.0], [0.92, 1.0, 1.0]] },
    unit: { p: [1.0, 0.72, 0.36], e: [0.58, 0.68, 0.9], ready: [0.36, 1.0, 0.45], target: [1.0, 0.3, 0.16], frozen: [0.45, 0.82, 1.0], shield: [1.0, 0.82, 0.36] },
  };
  const DISC = { 0: 1, 1: 1.45 };                          // the disc's radius × the station's (a minion's glow and ward reach past it)
  function halo(layer, style) {
    const mat = new THREE.ShaderMaterial({ vertexShader: HALO_VS, fragmentShader: HALO_FS, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uK: { value: 0 }, uAct: { value: 0 }, uT: { value: 0 }, uStyle: { value: style }, uTaunt: { value: 0 }, uShade: { value: style ? 0.3 : 0 },
        uTint: { value: new THREE.Color(0.4, 0.6, 1) }, uHot: { value: new THREE.Color(1, 1, 1) } } });
    mat.userData.toScreen = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2 * DISC[style], 2 * DISC[style]).rotateX(-Math.PI / 2), mat);
    m.position.y = 0.004; m.frustumCulled = false; m.renderOrder = -1;
    if (layer) m.layers.set(layer);
    const g = new THREE.Group(); g.add(m);
    g.userData = { halo: mat.uniforms, t: null, style };
    return g;
  }
  function paintHalo(g, side, b, T) {
    const d = g.userData, U = d.halo, st = b.state || {};
    const dt = d.t == null ? 1 : Math.min(0.1, Math.max(0, T - d.t)); d.t = T;
    const e = 1 - Math.exp(-dt * 7);
    let tint, hot, k, act = 0;
    if (d.style) {
      const want = st.target ? "target" : st.frozen ? "frozen" : st.shield ? "shield" : st.ready ? "ready" : "";
      tint = HALO.unit[want || side] || HALO.unit.p; hot = tint;
      k = want === "target" ? 0.95 + 0.18 * Math.sin(T * 6) : want ? 0.8 + 0.07 * Math.sin(T * 2.6) : st.taunt ? 0.5 : 0.38;
      U.uTaunt.value += ((st.taunt ? 1 : 0) - U.uTaunt.value) * e;
    } else {
      const want = st.target ? "target" : st.frozen ? "frozen" : st.ready ? "ready" : "", rest = b.tint || [0.4, 0.62, 1.4], m = Math.max(...rest) || 1;
      [tint, hot] = want ? HALO.hero[want] : [rest.map((x) => x / m), rest.map((x) => 0.6 + 0.4 * x / m)];
      k = want ? 1.05 + 0.12 * Math.sin(T * (want === "target" ? 6 : 2.6)) : 0.42 + 0.05 * Math.sin(T * 1.4);
      act = want ? 1 : 0;
    }
    U.uTint.value.lerp(_c.setRGB(...tint), e); U.uHot.value.lerp(_c.setRGB(...hot), e);
    U.uK.value += (k - U.uK.value) * e; U.uAct.value += (act - U.uAct.value) * e; U.uT.value = T;
  }
  const _c = new THREE.Color(), _c2 = new THREE.Color();
  /* The aim (after 万象棋's attack line): while the player aims a figure's attack, a line of light runs on the ground
   * from its feet to where the pointer rests — chevrons flowing toward the end — and a reticle stands there: free,
   * a faint warm ring turning slowly; on a target it may take, it snaps to that unit, tightens, turns red and spins
   * faster. Drawn with the halos (under the figures), in display space. */
  const AIM_BEAM_FS = /* glsl */ `
    uniform float uK, uT, uLen, uEnd; uniform vec3 uCol; varying vec2 vUv;
    void main() {
      float x = vUv.x, y = abs(vUv.y - 0.5) * 2.0, aa = max(fwidth(y), 1e-4);
      float core = 1.0 - smoothstep(0.1 - aa, 0.1 + aa, y);
      float glow = exp(-y * 3.5) * 0.3;
      float u = fract(x * uLen / 0.2 - uT * 2.4 + y * 0.55);            // chevrons, one every 0.2 world units
      float chev = (1.0 - smoothstep(0.07, 0.07 + 2.0 * aa + 0.02, abs(u - 0.5))) * (1.0 - smoothstep(0.62, 0.8, y));
      float ends = smoothstep(0.0, 0.12, x) * (1.0 - smoothstep(uEnd - 0.05, uEnd, x));
      gl_FragColor = vec4(uCol * (core * 0.75 + glow + chev * 0.85) * ends * uK, 0.0);
    }`;
  const AIM_RET_FS = /* glsl */ `
    uniform float uK, uT, uLock; uniform vec3 uCol; varying vec2 vUv;
    float band(float d, float w, float aa) { return 1.0 - smoothstep(w - aa, w + aa, abs(d)); }
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      float aa = max(fwidth(r), 1e-4), px = length(fwidth(p)) / max(r, 1e-3) / 1.5708;
      float R = mix(0.74, 0.62, uLock);
      float ring = band(r - R, 0.011, aa);
      float q = fract((a + uT * mix(0.5, 1.9, uLock)) / 1.5708);         // four quadrants, turning
      float bracket = band(r - 0.9, 0.018, aa) * (1.0 - smoothstep(0.3 - px, 0.3 + px, abs(q - 0.5)));
      float tick = (1.0 - smoothstep(0.02 - px, 0.02 + px, min(q, 1.0 - q))) * step(R + 0.05, r) * (1.0 - smoothstep(0.84, 0.86, r));
      float glow = exp(-abs(r - R) * 11.0) * 0.28 + exp(-abs(r - 0.9) * 16.0) * 0.12;
      float fill = (1.0 - smoothstep(0.0, R, r)) * 0.1 * uLock;
      float dot = (1.0 - smoothstep(0.045 - aa, 0.045 + aa, r)) * uLock;
      float c = ring + bracket * 0.9 + tick * 0.7 + glow + fill + dot;
      gl_FragColor = vec4(uCol * c * uK * (1.0 - smoothstep(0.96, 1.0, r)), 0.0);
    }`;
  const AIM_COL = { free: [1.0, 0.88, 0.7], lock: [1.0, 0.34, 0.18] };
  function aimMesh(fs, layer) {
    const mat = new THREE.ShaderMaterial({ vertexShader: HALO_VS, fragmentShader: fs, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      uniforms: { uK: { value: 0 }, uT: { value: 0 }, uLen: { value: 1 }, uEnd: { value: 1 }, uLock: { value: 0 }, uCol: { value: new THREE.Color(...AIM_COL.free) } } });
    mat.userData.toScreen = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat);
    m.frustumCulled = false; m.renderOrder = 0; m.visible = false;
    if (layer) m.layers.set(layer);
    return m;
  }

  function dropBase(scene, u) {
    if (!u.base) return;
    scene.remove(u.base);
    u.base.traverse((m) => { m.geometry?.dispose(); [].concat(m.material || []).forEach((x) => x.dispose()); });
    u.base = null;
  }

  function create(scene, o = {}) {
    const SIZE = o.size ?? 1;
    // a single contact stays within 1.25× its target's token (BATTLE_PRESENTATION_V2 §5): the star's radius is capped
    // for a token at board size (0.7 world units wide at size 1.25) and the needle sparks fly shorter than in Musou
    const STAR_MAX = 0.32 * SIZE, NEEDLE_K = 0.6;
    // o.fxLayer: the effects go on that camera layer (the battlefield draws them over its sprite figures, straight to
    // the screen): their shaders write linear colour, which the pixel pass used to encode — encode it themselves
    const toScreen = (mat) => {
      for (const m of [].concat(mat)) {
        if (!m?.isShaderMaterial || m.userData.toScreen) continue;
        m.userData.toScreen = true;
        const enc = "gl_FragColor = linearToOutputTexel(gl_FragColor);";
        m.fragmentShader = m.fragmentShader.replace(/\breturn;/g, `${enc} return;`).replace(/}\s*$/, `  ${enc}\n}`);
        m.needsUpdate = true;
      }
    };
    const fxScene = o.fxLayer ? { add: (m) => { m.layers.set(o.fxLayer); toScreen(m.material); scene.add(m); } } : scene;
    const fx = EmberVoxelFx.create(fxScene, { pixel: true, light: R.LIGHT, scale: S });
    // real fire (EmberFire) for a fire caster's shot (attack.fire): the fireball flies with its trail and bursts
    const fire = typeof EmberFire !== "undefined" ? EmberFire.system((m) => fxScene.add(m), (m) => scene.remove(m)) : null;
    // a signature figure's effects (EmberSkillFx): its blade's light and swoosh, its blow, its guard, its triumph
    const sfx = typeof EmberSkillFx !== "undefined" ? EmberSkillFx.create({ add: (m) => fxScene.add(m), remove: (m) => scene.remove(m), fire, hand: (u) => (u.fig ? emitterOf(u) : null),
      halo: o.baseLayer == null }) : null;    // (the battlefield's units stand on their own halos: no idle sigil over them)
    // the aim (see AIM_BEAM_FS): its line and reticle, eased in and out; set by aim()
    const aimAt = { beam: aimMesh(AIM_BEAM_FS, o.baseLayer ?? o.fxLayer), ret: aimMesh(AIM_RET_FS, o.baseLayer ?? o.fxLayer),
      from: V3(), to: V3(), r: 0.3, lock: 0, want: 0, k: 0 };
    scene.add(aimAt.beam, aimAt.ret);
    /** aim({ from, to, r, locked }) — ground points (Vector3), the reticle's radius (world units) — or aim(null) */
    function aim(a) {
      if (!a) { aimAt.want = 0; return; }
      aimAt.from.copy(a.from); aimAt.to.copy(a.to); aimAt.r = a.r; aimAt.locked = !!a.locked; aimAt.want = 1;
    }
    function stepAim(dt) {
      const A = aimAt, e = 1 - Math.exp(-dt * 14);
      A.k += (A.want - A.k) * e; A.lock += ((A.want && A.locked ? 1 : 0) - A.lock) * (1 - Math.exp(-dt * 20));
      const on = A.k > 0.01; A.beam.visible = A.ret.visible = on;
      if (!on) return false;
      const dx = A.to.x - A.from.x, dz = A.to.z - A.from.z, len = Math.hypot(dx, dz), r = A.r * (1 - 0.12 * A.lock);
      const col = _c.setRGB(...AIM_COL.free).lerp(_c2.setRGB(...AIM_COL.lock), A.lock);
      for (const m of [A.beam, A.ret]) { const U = m.material.uniforms; U.uT.value = T; U.uLock.value = A.lock; U.uCol.value.copy(col); }
      A.beam.material.uniforms.uK.value = A.k * (0.75 + 0.25 * A.lock) * (len > r * 1.2 ? 1 : 0);
      A.beam.material.uniforms.uLen.value = len; A.beam.material.uniforms.uEnd.value = Math.max(0.05, 1 - (r * 0.62) / Math.max(len, 1e-3));
      A.beam.position.set((A.from.x + A.to.x) / 2, 0.006, (A.from.z + A.to.z) / 2);
      A.beam.rotation.set(0, -Math.atan2(dz, dx), 0); A.beam.scale.set(Math.max(len, 1e-3), 1, 0.09 * SIZE);
      A.ret.material.uniforms.uK.value = A.k * (0.7 + 0.45 * A.lock);
      A.ret.position.set(A.to.x, 0.007, A.to.z); A.ret.scale.set(r * 2, 1, r * 2);
      return true;
    }
    const units = new Map();      // "side:uid" → unit
    const dying = [];             // units playing their death beat (their token may be gone already)
    const queue = [];             // units waiting for their figure bake
    const shots = [];             // projectiles the arena flies itself (o.shots)
    const trail = { on: false, base: V3(), tip: V3(), heavy: false, freeze: 0 };   // latest posed weapon edge
    const stats = { figures: 0, cues: [], bakeMs: {} };
    const broken = new Set();     // figure ids whose build failed: their tokens stay flat
    let frame = 0, acc = 0, T = 0, pumping = false, disposed = false;
    const wake = () => o.wake?.();
    const where = (ref) => (ref ? o.where?.(ref) ?? null : null);
    const pixelRatio = () => o.pixelRatio?.() ?? Math.min(globalThis.devicePixelRatio || 1, 2);
    const live = (u, on) => { try { o.live?.(u, on); } catch {} };

    // ------------------------------------------------------------------ units
    function set(side, uid, id, info = {}) {
      const k = key(side, uid);
      let u = units.get(k);
      if (u && u.id !== id) { drop(side, uid, false); u = null; }
      if (!u) {
        const spec = KIT.get(id);
        if (!spec || broken.has(id)) return null;
        u = { k, id, spec, side, uid: String(uid), info, fig: null, state: "baking", clip: "idle", t: 0, yaw: null, toward: null,
          atk: null, freeze: 0, glow: null, spawnAt: 0, lastFrom: null, pos: null };
        units.set(k, u); queue.push(u);
        stats.figures = units.size;
        pump();
      }
      u.info = info;
      if (u.state === "live") live(u, true);
      return u;
    }
    // the bake queue, one figure at a time. With a worker baker (o.bake → Promise of EmberVoxelKit.bakeData) the
    // voxels are made off the main thread; without one the bake runs in the page, and then only while the page says it
    // is quiet (o.ready): 0.1–0.7 s of main thread must never land inside a combat sequence. Building the mesh from a
    // bake takes a few ms, so a figure baked ahead (the page prewarms the cards in hand) assembles the moment its
    // token lands — a played card turns straight into its figure.
    let worker = !!o.bake;
    function pump(delay = 0) {
      if (pumping || !queue.length || disposed) return;
      pumping = true;
      setTimeout(async () => {
        const u = queue[0];
        if (!u || units.get(u.k) !== u || disposed) { queue.shift(); pumping = false; pump(); return; }
        if (!R.cached(u.id) && worker) {
          try { const data = await o.bake(u.id); if (!R.cached(u.id)) R.bake(u.id, data); }
          catch (error) { worker = false; console.warn("voxel worker unavailable; baking in the page.", String(error?.message || error)); }
          if (disposed) return;
        }
        if (!R.cached(u.id) && o.ready && !o.ready()) { pumping = false; pump(120); return; }
        const i = queue.indexOf(u); if (i >= 0) queue.splice(i, 1);
        pumping = false;
        if (units.get(u.k) === u) {
          try {
            const t0 = performance.now();
            u.fig = R.build(u.id, { pixelRatio: pixelRatio() });
            stats.bakeMs[u.id] = Math.round(R.cached(u.id)?.ms ?? performance.now() - t0);
            u.fig.root.visible = false;
            u.fig.root.scale.setScalar((u.spec.scale || 1) * SIZE);
            scene.add(u.fig.root);
            // its shaders compile in the background (a first draw would otherwise stall a frame); then it may arrive
            u.state = "compiling";
            Promise.resolve(o.warm ? o.warm(u.fig.root) : null).catch(() => {}).then(() => {
              if (units.get(u.k) === u && u.state === "compiling") { u.state = "arrive"; wake(); }
            });
          } catch (error) { console.warn("voxel figure failed", u.id, error); broken.add(u.id); units.delete(u.k); stats.figures = units.size; live(u, false); }
        }
        if (queue.length) pump();
        wake();
      }, delay);
    }
    // a figure is on stage once it shows (assembling or live); before that its unit is still a flat token
    const shown = (u) => !!u.fig && (u.state === "live" || u.state === "assembling");
    function drop(side, uid, animate) {
      const k = key(side, uid), u = units.get(k);
      if (!u) return;
      units.delete(k); stats.figures = units.size;
      live(u, false); sfx?.drop(u);
      const i = queue.indexOf(u); if (i >= 0) queue.splice(i, 1);
      if (animate && shown(u)) { die(u, u.lastFrom); return; }
      if (u.state === "dying") return;                   // its death beat finishes on its own
      if (u.fig) { scene.remove(u.fig.root); R.dispose(u.fig); }
      dropBase(scene, u);
    }
    function goLive(u) { u.state = "live"; u.fig.root.visible = true; live(u, true); }

    // ------------------------------------------------------------------ cues
    /* kind: attack | hurt | death | victory. opts: attack { toward, planned, ranged, tier, liftMs, contactMs, releaseMs,
     * durationMs } · hurt { tier, from, direction }. death → true when the unit's figure shatters (the page then skips
     * its own demise). */
    function cue(side, uid, kind, opts = {}) {
      const u = units.get(key(side, uid)) || dying.find((d) => d.side === side && d.uid === String(uid));
      if (!u) return false;
      stats.cues.push({ key: key(side, uid), kind, at: Math.round(performance.now()) });
      if (stats.cues.length > 30) stats.cues.shift();
      if (kind === "attack") {
        u.toward = opts.toward || null;
        if (!shown(u)) return true;                         // not on stage yet: the page animates its flat token
        if (u.state !== "live") goLive(u);
        const tm = C.timing(u.fig), a = u.spec.moves?.attack || {}, shoots = !!a.ranged;
        // the clip's contact (a shooter's release) lands on the director's contact (a shot's launch = lift)
        const align = shoots ? opts.liftMs : opts.contactMs;
        u.clip = "attack"; u.t = 0; u.freeze = 0;
        u.atk = { t0: performance.now(), alignMs: Math.max(60, align ?? tm.hit * 1000), H: tm.hit, tier: opts.tier || 1, ranged: shoots, dash: null };
        const sig = u.fig.sig;
        if (!shoots && opts.planned && opts.toward) {
          const lift = opts.liftMs ?? 110, contact = Math.max(lift + 40, opts.contactMs ?? 260), release = Math.max(contact, opts.releaseMs ?? contact);
          u.atk.dash = { lift, contact, release, back: Math.max(220, (opts.durationMs ?? release + 200) - release), tgt: null };
          // a signature leaps: off the ground at its share of the lead, landing on the blow; it stays there through the
          // landing and the rise, then hops home
          if (sig) Object.assign(u.atk.dash, { sig: true, lift: contact * sig.leap, stay: release + (sig.post[sig.post.length - 1][0] + sig.rise) * 1000, back: sig.back * 1000 });
        }
        // where its foe stands (a caster that calls its blow down on it marks the spot as it charges)
        const toward = opts.toward, target = () => { const g = toward && where(toward); if (!g) return null; const v = units.get(key(toward.side, toward.uid)); return { ground: V3(g.x, 0, g.z), center: v?.fig ? center(v) : g.clone().add(V3(0, 0.45 * SIZE, 0)) }; };
        if (sig && sfx) sfx.attack(u, { t0: u.atk.t0, align: u.atk.alignMs, contact: opts.contactMs, tier: opts.tier || 1, leap: sig.leap, target });
        // the sword of light: every judgment of the coded figure; a signature calls it down on its heavy blows only
        if (a.smite && !shoots && opts.toward && (!sig || ((opts.tier || 1) >= 3 && !sig.fx?.modern))) smite(u, opts.toward, u.atk.t0 + u.atk.alignMs, sig ? { stay: 650, quiet: true } : {});   // (a god's own heavy blow is its kit's)
        // a caster's charge (its model's spell): motes into the casting hand, an orb growing there, a rune circle
        // underfoot, all through the wind-up to the release; a sprite whirls in a ring of light
        const sp = u.fig.spell;
        if (sp && shoots && fire) {
          const ch = sig?.fx?.castHand, k = u.fig.root.scale.x, hand = () => (u.fig ? (ch && u.fig.bones[ch] ? u.fig.bones[ch].getWorldPosition(V3()) : emitterOf(u)) : null), feet = () => (u.fig ? u.fig.root.position.clone() : null);
          fire.gather(hand, feet, u.atk.alignMs, (sp.r ?? 0.075) * k, sp.look, { orb: !u.fig.fire, rise: !!sp.rise });
          if (sp.spin) fire.orbit(() => (u.fig ? center(u) : null), u.atk.alignMs * 0.8, 0.32 * k, sp.look);
        }
        // shots the arena flies: the gallery's, and a signature caster's bolt (in battle too); a call from the sky or the
        // ground flies nothing
        const flies = sig ? (sig.fx?.cast ?? "bolt") === "bolt" : o.shots;
        if (shoots && flies && opts.toward) shots.push({ u, to: opts.toward, at: u.atk.t0 + (opts.liftMs ?? 350), hit: u.atk.t0 + (opts.contactMs ?? 500), tier: opts.tier || 1, style: a.style, tint: a.tint, fire: !!a.fire, from: null, fired: false });
      } else if (kind === "hurt") {
        const tier = Math.max(1, Math.min(3, opts.tier || 1));
        u.glow = { f: 0, tier };
        u.lastFrom = opts.from || u.lastFrom;
        if (u.fig && u.state === "live") { u.stopF = Math.min(TIER[tier].freeze, 3); u.pendingHurt = true; }
        const a = opts.from && units.get(key(opts.from.side, opts.from.uid));
        if (a && a.fig && a.state === "live") {
          if (a.clip === "attack") a.freeze = a.fig.sig?.hitstop?.[tier] ?? TIER[tier].freeze;
          if (opts.direction === "outgoing" && (!a.spec.moves?.attack?.ranged || o.shots || a.fig.sig)) {
            if (a.fig.sig && sfx && u.fig) { sfx.impact(a, hitOf(u.fig ? center(u) : where(u), a), tier); knock(u, a, tier); }
            else burst(u, a, tier, a.spec.moves?.attack?.style);
          }
        }
        if (u.fig?.sig && sfx && u.state === "live") sfx.hurt(u, a);
      } else if (kind === "death") {
        // it shatters if it was on stage (or a page render already started its beat through drop); a figure that never
        // showed leaves quietly and the page plays its own demise
        const shatters = u.state === "dying" || shown(u);
        if (shatters) die(u, u.lastFrom); else drop(u.side, u.uid, false);
        wake();
        return shatters;
      } else if (kind === "cast") {
        // a hero's power: its attack clip alone, in place — the power's own effect is the effect layer's
        if (!u.fig || u.state !== "live" || u.clip === "attack") return true;
        // one whose attack is a leap or a lunge commands instead: its weapon raised (the victory clip, briefly)
        if (u.fig.sig?.dash) { u.clip = "victory"; u.t = 0.35; return true; }
        const tm = C.timing(u.fig);
        u.clip = "attack"; u.t = 0; u.freeze = 0; u.toward = null;
        u.atk = { t0: performance.now(), alignMs: Math.max(60, opts.alignMs ?? tm.hit * 1000), H: tm.hit, tier: 1, ranged: false, dash: null };
      } else if (kind === "victory") {
        if (u.fig && u.state === "live" && u.clip !== "attack") { u.clip = "victory"; u.t = 0; if (u.fig.sig) sfx?.victory(u); }
      }
      wake();
      return true;
    }
    /** a damage contact on any unit (figure, flat token or hero): a victim figure glows and recoils; when the attacker
     *  is a melee figure the contact burst is drawn at the victim (its ground point when it has no figure) */
    function contact(ref, opts = {}) {
      if (disposed) return false;
      const tier = Math.max(1, Math.min(3, opts.tier || 1));
      if (units.has(key(ref.side, ref.uid))) cue(ref.side, ref.uid, "hurt", opts);
      else {
        const a = opts.from && units.get(key(opts.from.side, opts.from.uid));
        if (!a || !a.fig || a.state !== "live" || (a.spec.moves?.attack?.ranged && !o.shots && !a.fig.sig) || opts.direction !== "outgoing") return false;
        if (a.clip === "attack") a.freeze = a.fig.sig?.hitstop?.[tier] ?? TIER[tier].freeze;
        const g = where(ref); if (!g) return false;
        if (a.fig.sig && sfx) sfx.impact(a, hitOf(g.clone().add(V3(0, 0.45 * SIZE, 0)), a), tier);
        else burst(ghost(g, a), a, tier, a.spec.moves?.attack?.style);
      }
      wake();
      return true;
    }
    // a stand-in victim for a unit without a figure (a flat token or a hero): its ground point and a figure-sized box
    const ghost = (g, a) => ({ fig: { root: { position: g, scale: { x: SIZE } }, mesh: { geometry: { boundingBox: { min: { y: 0 }, max: { y: 0.9 } } } }, vox: a.fig.vox }, spec: { scale: 1 }, pal: paletteOf(a) });
    /** a figure stands for this unit (melee = only when its attack is melee) */
    const owns = (side, uid, melee = false) => {
      const u = units.get(key(side, uid));
      return !!(u && shown(u) && !(melee && u.spec.moves?.attack?.ranged));
    };
    /** for the attack planner: how this unit's figure attacks — a melee dash, or a shot with `windup` ms of drawing */
    function plan(side, uid) {
      if (!owns(side, uid)) return null;
      const u = units.get(key(side, uid)), a = u.spec.moves?.attack || {};
      // shots: a signature caster flies its own (the page leaves its projectile out)
      return { melee: !a.ranged, windup: a.ranged ? u.fig?.spell?.windup ?? a.windup ?? 260 : u.fig?.sig?.windup ?? 0, shots: !!(a.ranged && u.fig?.sig) };
    }

    // contact burst on the victim (voxel-musou: pixel star with 13 spikes + needle sparks, warm → cool with the tier)
    function burst(v, a, tier, style) {
      if (!v.fig) return;
      const c = center(v), from = a.fig.root.position, d = V3(c.x - from.x, 0, c.z - from.z);
      if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
      const p = c.clone().addScaledVector(d, -0.12 * v.fig.root.scale.x);
      const T3 = TIER[tier], cool = tier >= 3, tint = a.spec.moves?.attack?.tint;
      const pal = cool ? fx.PAL.HOT_COOL : fx.PAL.NEEDLE_WARM;
      fx.needleBurst(p.x, p.y, p.z, T3.needles, d.x, d.z, T3.spd * S * NEEDLE_K, tint ? [[...hex3(tint, 1.2)], [...hex3(tint, 0.6)], [1.6, 1.4, 1.1]] : pal, (cool ? 0.065 : 0.055) * S, 1.5, fx.pools.hot);
      fx.star(p.x, p.y, p.z, Math.min(STAR_MAX, T3.star * v.fig.root.scale.x), cool ? 0.15 : 0.13, tint ? hex3(tint, 0.5) : cool ? fx.PAL.BURST_COOL : fx.PAL.FLASH_WARM, -1, 1);
      if (style === "thrust" && cool) {
        const o2 = from.clone().addScaledVector(d, 0.2);
        fx.beam(fx.KIND.STREAK, o2.x, p.y, o2.z, d.x, 0, d.z, 1.1, 0.3, 0.2, [1.2, 1.9, 2.8]);
      }
      if (style === "blunt") fx.ring(v.fig.root.position.x, v.fig.root.position.z, 0.5, 0.3, [1.4, 1.0, 0.6]);
      if (fx.rng.chance(tier >= 2 ? 0.7 : 0.35)) fx.chunks(p.x, p.y - 0.1, p.z, 1, d.x, d.z, 3 * S, paletteOf(v), 0.06 * S, 0.12 * S, [2 * S, 5 * S], [0.25, 0.4]);
    }
    /** where a blow lands on a victim centred at c (a signature's impact): the centre, the ground under the front of
     *  it, the direction it came from */
    function hitOf(c, a) {
      const from = a.fig.root.position, dir = V3(c.x - from.x, 0, c.z - from.z);
      if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1); dir.normalize();
      return { at: c.clone(), ground: V3(c.x, 0, c.z).addScaledVector(dir, -0.1 * a.fig.root.scale.x), dir };
    }
    /** a heavy blow shoves its victim back a step, which it recovers (a signature's blows) */
    function knock(v, a, tier) {
      const d = V3(v.fig.root.position.x - a.fig.root.position.x, 0, v.fig.root.position.z - a.fig.root.position.z);
      if (d.lengthSq() < 1e-6) return; d.normalize();
      const lift = a.fig.sig?.fx?.lift ?? 0;                   // a blow that tosses its victim up (a pillar of fire)
      v.kb = { t0: performance.now(), d, amt: (tier >= 3 ? 0.13 : 0.08) * v.fig.root.scale.x * (lift ? 0.3 : 1), up: lift * v.fig.root.scale.x * (tier >= 3 ? 1.2 : 1) };
    }
    function knockOffset(v, now) {
      const up = v.kb.up || 0, q = (now - v.kb.t0) / (up ? 700 : 420);
      if (q >= 1) { v.kb = null; return null; }
      const s = q < 0.22 ? 1 - Math.pow(1 - q / 0.22, 3) : 1 - ((q - 0.22) / 0.78) ** 2 * (3 - 2 * (q - 0.22) / 0.78);
      return v.kb.d.clone().multiplyScalar(v.kb.amt * s).setY(up * 4 * q * (1 - q));
    }
    // ------------------------------------------------------------------ smite: a sword of holy light (attack.smite)
    // It gathers high above the target as the attacker springs, plunges and lands on the director's contact, stands
    // in the ground through the hit-stop and fades; a sun sigil on the ground marks the spot. Camera-facing quads
    // drawn from a signed-distance sword (in sword lengths: tip at 0, pommel at 1), additive like the other light
    const SMITE_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
    const SWORD_FS = /* glsl */ `
      uniform float uK, uFall, uExt, uW; uniform vec3 uCore, uGlow; varying vec2 vUv;
      float box(vec2 p, vec2 c, vec2 h) { vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
      void main() {
        vec2 p = vec2((vUv.x - 0.5) * uW, vUv.y * (uExt + 0.15) - 0.15);
        float hw = 0.04 * smoothstep(0.0, 0.22, p.y) * (1.0 - 0.18 * p.y);
        float d = max(abs(p.x) - hw, max(-p.y, p.y - 0.7));
        vec2 g = p - vec2(0.0, 0.72); g.y -= 0.35 * g.x * g.x / 0.17;              // the cross-guard sweeps up at its ends
        d = min(d, box(g, vec2(0.0), vec2(0.19, 0.02)));
        d = min(d, box(p, vec2(0.0, 0.82), vec2(0.022, 0.09)));
        d = min(d, length(p - vec2(0.0, 0.94)) - 0.036);
        d = min(d, abs(length(p - vec2(0.0, 0.72)) - 0.1) - 0.009);                // a halo round the guard
        float e = max(d, 0.0);
        float inside = 1.0 - smoothstep(0.0, 0.004, d), mid = 1.0 - smoothstep(0.0, 1.0, abs(p.x) / 0.04);
        vec3 c = inside * (uGlow * 0.75 + uCore * 0.55 * mid) + uCore * 0.7 * exp(-abs(d) * 320.0)
               + uGlow * (exp(-e * 60.0) * 0.45 + exp(-e * 18.0) * 0.13);
        c += uCore * 0.35 * (1.0 - smoothstep(0.0, 0.003, abs(p.x) - 0.003)) * step(0.1, p.y) * step(p.y, 0.66);   // the fuller
        c += uGlow * uFall * exp(-abs(p.x) * 26.0) * exp(-max(0.0, p.y - 0.96) * 2.4) * step(0.9, p.y);          // the fall streak
        // soft to nothing at the quad's sides and ends (no visible box round the glow)
        float edge = (1.0 - smoothstep(0.55, 1.0, abs(vUv.x - 0.5) * 2.0)) * smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.8, 1.0, vUv.y));
        gl_FragColor = vec4(c * uK * edge, 0.0);
      }`;
    const SIGIL_FS = /* glsl */ `
      uniform float uK, uRot; uniform vec3 uGlow; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x) + uRot;
        float ring = exp(-abs(r - 0.92) * 90.0) + 0.7 * exp(-abs(r - 0.7) * 120.0);
        float f = abs(fract(a * 12.0 / 6.2832) - 0.5) * 2.0;                            // 12 rays between the rings
        float ray = (1.0 - smoothstep(0.0, 0.18 * (1.0 - smoothstep(0.25, 0.68, r)), f)) * step(0.22, r) * step(r, 0.68);
        float runes = step(0.78, r) * step(r, 0.86) * step(0.55, fract(a * 36.0 / 6.2832 + 0.25 * sin(a * 7.0)));
        float c = ring + 0.8 * ray + 0.5 * runes + 0.5 * exp(-r * 5.0);
        gl_FragColor = vec4(uGlow * c * uK * (1.0 - smoothstep(0.95, 1.0, r)), 0.0);
      }`;
    const ADDB = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
    const SWORD_EXT = 1.9, SWORD_W = 0.5;
    const smites = [];
    function smiteMeshes() {
      const sword = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({ vertexShader: SMITE_VS, fragmentShader: SWORD_FS, side: THREE.DoubleSide, ...ADDB,
        uniforms: { uK: { value: 0 }, uFall: { value: 0 }, uExt: { value: SWORD_EXT }, uW: { value: SWORD_W }, uCore: { value: new THREE.Color(1.6, 1.5, 1.2) }, uGlow: { value: new THREE.Color(1.3, 0.72, 0.22) } } }));
      const sigil = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ vertexShader: SMITE_VS, fragmentShader: SIGIL_FS, side: THREE.DoubleSide, ...ADDB,
        uniforms: { uK: { value: 0 }, uRot: { value: 0 }, uGlow: { value: new THREE.Color(1.5, 0.85, 0.28) } } }));
      for (const m of [sword, sigil]) { m.frustumCulled = false; m.renderOrder = 14; fxScene.add(m); }
      return { sword, sigil };
    }
    // the lead: it gathers high above the foe while the attacker raises her blade (70%), then slams down (30%); it
    // stands in the ground for STAY ms — pulsing, shedding motes of light — to show the weight of the blow
    const STAY = 1300;
    /** o.stay: how long it stands (ms) · o.quiet: its landing makes no burst of its own (the blow's effects do) */
    function smite(u, to, land, o = {}) {
      const lead = Math.max(280, (land - u.atk.t0) * 0.9);
      smites.push({ u, to, land, start: land - lead, hit: false, m: smiteMeshes(), at: null, mote: 0, stay: o.stay ?? STAY, quiet: !!o.quiet });
    }
    function stepSmites(now, camera) {
      for (let i = smites.length - 1; i >= 0; i--) {
        const s = smites[i], g = where(s.to) || s.at;
        const { sword, sigil } = s.m, done = now > s.land + s.stay;
        if (!g || done) { for (const m of [sword, sigil]) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); } smites.splice(i, 1); continue; }
        s.at = g.clone();
        const v = units.get(key(s.to.side, s.to.uid)), k = v?.fig ? v.fig.root.scale.x : SIZE, L = 1.3 * k;
        const r = now - s.start, F = s.land - s.start, q = Math.max(0, Math.min(1, r / F));
        let y, K, fall = 0, sq = 1;
        if (now < s.land) {
          const m = Math.min(1, q / 0.7), dq = Math.max(0, (q - 0.7) / 0.3);
          y = ((0.55 + 0.05 * Math.sin(now * 0.012)) * (1 - dq * dq) - 0.2 * dq * dq) * L; K = 0.15 + 0.7 * m * m + 0.15 * dq; fall = dq > 0 ? 0.5 + 0.5 * dq : 0;
          sq = 0.6 + 0.4 * m;                                           // it narrows in as it forms
        } else {
          const a = (now - s.land) / s.stay, out = Math.max(0, (a - 0.7) / 0.3);
          y = -0.2 * L; K = (a < 0.05 ? 1.3 : 0.62 + 0.38 * Math.exp(-(a - 0.05) * 9)) * (1 - out * out) * (0.88 + 0.12 * Math.sin(now * 0.025));   // a blinding slam, then it stands, calmer, the foe visible through it
          if (!s.hit) { s.hit = true; if (!s.quiet) impact(g, k); }
          if (!s.quiet && a < 0.75 && now - s.mote > 70) {                        // motes rising off the blade while it stands
            s.mote = now;
            fx.embers(g.x, (0.2 + 0.8 * Math.random()) * L, g.z, 2, 0.06 * k, [2.2, 1.45, 0.55]);
          }
          if (!s.quiet && a < 0.6 && Math.floor(a * 5) !== s.beat) { s.beat = Math.floor(a * 5); fx.beam(fx.KIND.PILLAR, g.x, 0, g.z, 0, 1, 0, 2.3 * k, 0.1 * k, 0.4, [1.2, 0.75, 0.25]); }
        }
        if (now < s.start) K = 0;
        sword.position.set(g.x, y - 0.15 * L, g.z); sword.scale.set(L * SWORD_W * sq, L * (SWORD_EXT + 0.15), 1);
        sword.rotation.set(0, Math.atan2(camera.position.x - g.x, camera.position.z - g.z), 0);
        sword.material.uniforms.uK.value = K; sword.material.uniforms.uFall.value = fall;
        const R2 = 0.62 * k, after = Math.max(0, (now - s.land) / s.stay), grow = now < s.land ? 0.55 + 0.45 * q : 1 + 0.25 * Math.sqrt(after);
        sigil.position.set(g.x, 0.012, g.z); sigil.scale.setScalar(R2 * grow);
        sigil.material.uniforms.uK.value = now < s.land ? 0.9 * q : 1.25 * (1 - Math.pow(after, 2));
        sigil.material.uniforms.uRot.value = r * 0.0015;
      }
    }
    function impact(g, k) {
      const x = g.x, z = g.z, GOLD = [2.2, 1.35, 0.45], WHITE = [2.4, 2.2, 1.8];
      fx.beam(fx.KIND.PILLAR, x, 0, z, 0, 1, 0, 2.8 * k, 0.2 * k, 0.9, GOLD);
      fx.beam(fx.KIND.PILLAR, x, 0, z, 0, 1, 0, 2.2 * k, 0.06 * k, 0.3, WHITE);
      fx.ring(x, z, 0.75 * k, 0.4, [1.8, 1.1, 0.4]);
      fx.ring(x, z, 1.15 * k, 0.55, [1.0, 0.6, 0.2]);
      fx.star(x, 0.28 * k, z, Math.min(STAR_MAX * 1.4, 0.5 * k), 0.16, [0.9, 0.55, 0.15], -1, 1);
      for (let a = 0; a < 6; a++) { const t = (a / 6) * Math.PI * 2 + 0.3; fx.needleBurst(x, 0.1 * k, z, 4, Math.cos(t), Math.sin(t), 13 * S * NEEDLE_K, [[1.8, 1.2, 0.4], [2.2, 1.7, 0.9], [1.4, 0.7, 0.18]], 0.05 * S, 1.3, fx.pools.hot); }
      fx.embers(x, 0.3 * k, z, 22, 0.25 * k, [2.4, 1.5, 0.5]);
      fx.dustRing(x, z, 14, 0.12 * k, 2.2 * S, 0.4 * S, 0.45);
      fx.flashAt?.(0.55, 0.05, 2.5);
      fx.dustColumn?.(x, z, 6, 0.1 * k, 0.35 * k, 0.5 * k);
    }
    function paletteOf(u) {
      if (u.pal) return u.pal;
      const V = u.fig.vox, out = [];
      for (let i = 0; i < V.bone.length; i += 11) out.push([V.color[i * 3], V.color[i * 3 + 1], V.color[i * 3 + 2]]);
      return (u.pal = out.length ? out : [[0.4, 0.4, 0.4]]);
    }
    const center = (u) => { const b = u.fig.mesh.geometry.boundingBox, s = u.fig.root.scale.x; return u.fig.root.position.clone().add(V3(0, (b.min.y + b.max.y) * 0.45 * s, 0)); };

    // death beat (≈ 0.52 s, as the DOM's): a short launch away from the last attacker, then it shatters into its own
    // voxels, which bounce once and sink before the beat ends
    function die(u, from) {
      if (u.state === "dying") return;
      units.delete(u.k); stats.figures = units.size;
      live(u, false); sfx?.drop(u);                        // its station's sigil and any effect riding it go with it
      if (!u.fig || u.state === "baking") { dropBase(scene, u); return; }
      u.state = "dying"; u.dieF = frame; dying.push(u);
      u.fig.root.visible = true;
      const p = u.fig.root.position, a = from && units.get(key(from.side, from.uid));
      const d = a && a.fig ? V3(p.x - a.fig.root.position.x, 0, p.z - a.fig.root.position.z) : V3(0, 0, u.side === "p" ? 1 : -1);
      if (d.lengthSq() < 1e-6) d.set(0, 0, 1); d.normalize();
      u.fly = { v: V3(d.x * 1.1, 2.0, d.z * 1.1), axis: V3(0, 1, 0).cross(d).normalize(), rot: 0, dir: d, q0: u.fig.root.quaternion.clone(), p0: p.clone() };
      u.glow = { f: 0, tier: 3, kill: true };
    }
    function shatter(u) {
      const { pts, cols, size } = R.voxelsWorld(u.fig), c = center(u);
      fx.shatter(pts, cols, c, u.fly.dir, { n: 420, spd: 2.0 * S, up: [1.0 * S, 2.8 * S], size, life: [0.24, 0.34] });
      fx.dustPuff(c.x, c.z, 2, 1.6 * S, 0.36 * S, 0.08 * S, 0.3);
      u.fig.root.visible = false; u.shattered = frame;
      dropBase(scene, u);
    }

    // ------------------------------------------------------------------ per frame
    function facing(u, from) {
      let target = null;
      if (u.toward && u.clip === "attack") target = where(u.toward);
      let want;
      if (target) { const dx = target.x - from.x, dz = target.z - from.z; want = Math.atan2(dx, dz); }
      // idle: each side faces the other across the board (the player's own units show a three-quarter back), turned a
      // little toward the middle of the opposing line
      else want = Math.atan2(-0.3 * from.x, u.side === "p" ? -1 : 1);
      if (u.yaw == null) u.yaw = want;
      let d = want - u.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      u.yaw += d * Math.min(1, target ? 0.45 : 0.1);
      u.fig.root.rotation.set(0, u.yaw, 0);
    }
    /** attack clip time: the part before contact is stretched onto the director's contact, the rest runs at speed */
    function attackTime(u, now) {
      const a = u.atk, r = (now - a.t0) / 1000, c = a.alignMs / 1000;
      return r <= c ? (r / c) * a.H : a.H + (r - c);
    }
    /** a melee figure's dash on the director's timeline: holds home through the lift (its clip coils), accelerates onto
     *  the strike point by the contact, holds through the hit-stop, hops back home */
    function dashOffset(u, home, now) {
      const d = u.atk.dash, r = now - u.atk.t0;
      // a god strikes from where it stands, risen a little off the ground as it commands the blow
      if (u.fig.stay) { const lv = u.fig.sig?.levitate; if (!lv || r >= d.contact + 400) return null; const q = r / d.contact, k = u.fig.root.scale.x; return V3(0, lv * k * (q < 0.35 ? ease3(q / 0.35) : q < 1 ? 1 : 1 - ease3((r - d.contact) / 400)), 0); }
      const g = where(u.toward);
      if (g) d.tgt = g;
      if (!d.tgt || r >= (d.sig ? d.stay : d.release) + d.back) return null;
      const v = units.get(key(u.toward.side, u.toward.uid));
      const clip = u.spec.moves?.attack?.clip;
      const reach = (u.fig.sig?.reach ?? u.spec.moves?.attack?.reach ?? REACH[clip] ?? REACH_DEFAULT) * u.fig.root.scale.x + (v?.fig ? 0.14 * v.fig.root.scale.x : 0.3);
      // strike from a diagonal on the side the attacker comes from: straight in, the nearer figure would hide the other
      // (the board is seen from a low angle, so depth is short on screen)
      const bx = home.x - d.tgt.x, bz = home.z - d.tgt.z, bl = Math.hypot(bx, bz) || 1;
      if (bl <= reach) return null;
      const side = Math.abs(bx) > 0.2 ? Math.sign(bx) : u.side === "p" ? -1 : 1;
      let ax = (bx / bl) * 0.72 + side * 0.7, az = (bz / bl) * 0.72;
      const al = Math.hypot(ax, az); ax /= al; az /= al;
      const sx = d.tgt.x + ax * reach - home.x, sz = d.tgt.z + az * reach - home.z;
      let s = 0, hop = 0;
      if (d.sig) {
        // a leap (its height is the clip's): even speed through the air · a lunge: late and fast onto the foe; held there
        // through the landing and the rise; a hop home. A god rises off the ground as it charges and comes down on the blow
        if (r >= d.stay + d.back) return null;
        const sg = u.fig.sig, k = u.fig.root.scale.x;
        if (r >= d.lift && r < d.contact) { const q = (r - d.lift) / (d.contact - d.lift); s = sg?.dash === "lunge" ? Math.pow(q, 1.8) : 0.25 * q + 0.75 * ease3(q); }
        else if (r >= d.contact && r < d.stay) s = 1;
        else if (r >= d.stay) { const q = (r - d.stay) / d.back; s = 1 - ease3(q); hop = 0.1 * k * Math.sin(Math.PI * q); }
        if (sg?.levitate && r < d.contact) { const q = r / d.contact; hop += sg.levitate * k * (q < 0.8 ? ease3(q / 0.8) : 1 - ((q - 0.8) / 0.2) ** 2); }
        return V3(sx * s, hop, sz * s);
      }
      if (r >= d.lift && r < d.contact) { const q = (r - d.lift) / (d.contact - d.lift); s = Math.pow(q, 1.6); hop = 0.05 * Math.sin(Math.PI * q); }
      else if (r >= d.contact && r < d.release) s = 1;
      else if (r >= d.release) { const q = (r - d.release) / d.back; s = Math.pow(1 - q, 3); hop = 0.07 * Math.sin(Math.PI * q); }
      return V3(sx * s, hop, sz * s);
    }
    const ease3 = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
    function glowOf(u) {
      const g = u.glow; if (!g) { R.setHit(u.fig, 0, 0, 0); return; }
      const D = 11 + (g.tier >= 2 ? 3 : 0), fl = D + 1 - g.f;
      const ember = g.kill && u.state === "dying" ? 0.22 : 0;
      if (g.f === 0) R.setHit(u.fig, ...HOT);
      else if (fl > 0 || ember) { const q = Math.max(0, Math.min(1, fl / (D - 1))), k = Math.max(ember, q * q), c = g.kill ? TINT[3] : TINT[g.tier]; R.setHit(u.fig, c[0] * k, c[1] * k, c[2] * k); }
      else { R.setHit(u.fig, 0, 0, 0); u.glow = null; }
    }
    // a shot the arena flies itself (gallery): arrow / bolt / breath from the shooter's emitter to the target
    function emitterOf(u) {
      const a = u.spec.moves?.attack || {}, e = a.emitter;
      if (e && u.fig.J[e.bone]) { u.fig.J[e.bone].updateWorldMatrix(true, false); return u.fig.J[e.bone].localToWorld(V3(...(e.offset || [0, 0, 0]))); }
      return center(u).add(V3(0, 0.15 * u.fig.root.scale.x, 0));
    }
    // an arrow: shaft, steel head and red fletching, flown along a shallow arc point-first from the bow hand
    function arrowMesh(k) {
      const g = new THREE.Group(), L = 0.55 * k;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0055 * k, 0.0055 * k, L, 6), new THREE.MeshBasicMaterial({ color: 0x6b4a2b }));
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.014 * k, 0.05 * k, 6), new THREE.MeshBasicMaterial({ color: 0xc9d2da }));
      head.position.y = L / 2 + 0.025 * k;
      g.add(shaft, head);
      for (const r of [0, Math.PI / 2]) {
        const f = new THREE.Mesh(new THREE.PlaneGeometry(0.03 * k, 0.07 * k), new THREE.MeshBasicMaterial({ color: 0xb8322a, side: THREE.DoubleSide }));
        f.position.y = -L / 2 + 0.04 * k; f.rotation.y = r; g.add(f);
      }
      const parts = [...g.children];
      for (const m of parts) { m.userData.o = m.position.clone(); m.userData.ry = m.rotation.y; m.frustumCulled = false; fxScene.add(m); }
      return parts;
    }
    function flyArrow(s, end, now) {
      const k = s.u.fig.root.scale.x;
      if (!s.arrow) {
        const h = s.u.fig.bones?.LeftHand; if (h) { h.updateWorldMatrix(true, false); s.from = h.getWorldPosition(V3()); }
        s.parts = arrowMesh(k); s.arrow = true;
      }
      const q = Math.min(1, (now - s.at) / Math.max(60, s.hit - s.at)), arc = 0.12 * k * s.from.distanceTo(end);
      const at = (u) => s.from.clone().lerp(end, u).add(V3(0, Math.sin(u * Math.PI) * arc, 0));
      const p = at(q), dir = at(Math.min(1, q + 0.02)).sub(at(Math.max(0, q - 0.02))).normalize();
      const rot = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), dir);
      for (const m of s.parts) { m.position.copy(m.userData.o).applyQuaternion(rot).add(p); m.quaternion.copy(rot).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, m.userData.ry, 0))); }
      fx.embers(p.x, p.y, p.z, 1, 0.01 * S, [1.4, 1.3, 1.1]);
      if (q < 1) return false;
      for (const m of s.parts) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
      return true;
    }
    function flyShots(now) {
      for (let i = shots.length - 1; i >= 0; i--) {
        const s = shots[i];
        if (now < s.at || !s.u.fig) continue;
        const to = where(s.to);
        if (!to) { shots.splice(i, 1); continue; }
        const v = units.get(key(s.to.side, s.to.uid)), end = v?.fig ? center(v) : to.clone().add(V3(0, 0.45 * SIZE, 0));
        if (!s.fired) {
          s.fired = true; s.from = emitterOf(s.u);
          if (s.fire && fire) fire.shoot(s.from, end, Math.max(60, s.hit - now), 0.1 * s.u.fig.root.scale.x);
          else if (s.u.fig.spell && fire) { const sp = s.u.fig.spell; s.fire = true; fire.shoot(s.from, end, Math.max(60, s.hit - now), (sp.bolt ?? 0.08) * s.u.fig.root.scale.x, sp.look); }
        }
        if (s.fire && fire) { if (now >= s.hit) shots.splice(i, 1); continue; }
        // a realistic archer (a model figure) has no coded bow clip to fly its arrow: the arena flies a real one
        if (s.style === "arrow" && s.u.fig.model) { if (flyArrow(s, end, now)) shots.splice(i, 1); continue; }
        const q = Math.min(1, (now - s.at) / Math.max(60, s.hit - s.at)), p = s.from.clone().lerp(end, q);
        const col = s.tint ? hex3(s.tint, 2.2) : s.style === "breath" ? [2.4, 0.95, 0.28] : [1.6, 1.1, 2.4];
        if (s.style === "breath") fx.embers(p.x, p.y, p.z, 5, 0.07 * S, col);
        else if (s.style !== "arrow") fx.embers(p.x, p.y, p.z, 2, 0.02 * S, col);   // the bow clip flies its own arrow
        if (q >= 1) shots.splice(i, 1);
      }
    }
    function tick() {                                           // one 60 Hz step: effect ages, hitstop, glow, death beat
      frame++;
      fx.trailStep(trail.on, trail.base, trail.tip, trail.heavy, 0, trail.freeze);
      fx.step(frame);
      for (const u of units.values()) {
        if (u.glow) u.glow.f++;
        if (u.freeze > 0) u.freeze--;
        if (u.pendingHurt && --u.stopF < 0) { u.pendingHurt = false; if (u.clip !== "attack") { u.clip = "hurt"; u.t = 0; } }
      }
      for (let i = dying.length - 1; i >= 0; i--) {
        const u = dying[i], age = frame - u.dieF;
        if (u.glow) u.glow.f++;
        if (!u.shattered) {
          const dt = 1 / FPS, v = u.fly.v;
          v.y -= 13 * (Math.abs(v.y) < 1 ? 0.5 : 1) * dt;
          u.fly.p0.addScaledVector(v, dt); u.fly.rot += 5.5 * dt;
          if (age >= 9 || (u.fly.p0.y <= 0 && v.y < 0)) shatter(u);
        } else if (frame - u.shattered > 21) { scene.remove(u.fig.root); R.dispose(u.fig); dying.splice(i, 1); }
      }
    }
    /** advance and pose everything for this frame (the page renders afterwards); true while anything is on stage */
    function step(now, camera, dt) {
      if (disposed) return false;
      T += dt;
      acc += dt;
      let n = 0;
      while (acc >= 1 / FPS && n < 4) { tick(); acc -= 1 / FPS; n++; }
      if (n === 4) acc = 0;
      fx.setCamera(camera.position);
      let attacker = null;
      for (const u of units.values()) {
        if (!u.fig) continue;
        const p = where(u);
        if (p) u.pos = p;
        if (!u.pos) continue;
        u.fig.root.position.copy(u.pos);
        if (o.scaleOf) u.fig.root.scale.setScalar((u.spec.scale || 1) * SIZE * o.scaleOf(u));
        const b = o.base && (u.state === "live" || u.state === "assembling") ? o.base(u) : null;
        if (b) {
          if (!u.base) { u.base = halo(o.baseLayer ?? o.fxLayer, b.ring ? 0 : 1); scene.add(u.base); }
          u.base.position.copy(u.pos); u.base.scale.setScalar(b.r);
          paintHalo(u.base, u.side, b, T);
        } else if (u.base) dropBase(scene, u);
        if (u.state === "live" && u.atk?.dash) { const off = dashOffset(u, u.pos, now); if (off) u.fig.root.position.add(off); }
        if (u.kb) { const off = knockOffset(u, now); if (off) u.fig.root.position.add(off); }
        if (u.state === "arrive") {        // its token just landed: it assembles there (bake and compile were off-frame)
          facing(u, u.fig.root.position);
          C.pose(u.fig, "idle", 0, T);
          const { pts, cols, size } = R.voxelsWorld(u.fig);
          fx.assemble(pts, cols, frame, ASSEMBLE, { n: 900, size });
          u.state = "assembling"; u.spawnAt = frame;
        } else if (u.state === "assembling" && frame - u.spawnAt >= ASSEMBLE + 2) {
          goLive(u);
          fx.dustPuff(u.fig.root.position.x, u.fig.root.position.z, 2, 1.2 * S, 0.34 * S, 0.05 * S, 0.3);
        }
        if (u.state !== "live") continue;
        facing(u, u.fig.root.position);
        if (u.clip === "attack") {
          if (u.freeze <= 0) u.t = attackTime(u, now); else u.atk.t0 += dt * 1000;   // hitstop holds the pose
          if (!C.pose(u.fig, "attack", u.t, T)) { u.clip = "idle"; u.t = 0; u.toward = null; u.atk = null; C.pose(u.fig, "idle", 0, T); }
          else attacker = u;
        } else {
          u.t += dt;
          if (!C.pose(u.fig, u.clip, u.t, T) && u.clip !== "idle") { u.clip = "idle"; u.t = 0; }
        }
        if (u.fig.model) sfx?.frame(u, now);
        glowOf(u);
      }
      for (const u of dying) {
        if (u.shattered) continue;
        const q = new THREE.Quaternion().setFromAxisAngle(u.fly.axis, -u.fly.rot);
        u.fig.root.position.copy(u.fly.p0); u.fig.root.quaternion.copy(q.multiply(u.fly.q0));
        glowOf(u);
      }
      // weapon trail of the current attacker, sampled from the posed weapon
      let on = false, base = null, tip = null;
      if (attacker) {
        const m = attacker.spec.moves?.attack, tr = m?.trail, tm = attacker.atk;
        // a realistic model's swoosh is drawn smooth (EmberSkillFx), a signature's by its own kit; the sculpted figures
        // keep the pixel ribbon
        if (attacker.fig.model && !attacker.fig.sig && sfx) sfx.swing(attacker, attacker.t > tm.H - 0.12 && attacker.t < tm.H + 0.1, now);
        else if (tr && (m.style === "slash" || m.style === "thrust") && !attacker.fig.sig) {
          const holder = tr.prop ? attacker.fig.props.find((p) => p.grip === tr.prop)?.holder : attacker.fig.J[tr.bone];
          if (holder) {
            holder.updateWorldMatrix(true, false);
            base = holder.localToWorld(V3(...tr.from)); tip = holder.localToWorld(V3(...tr.to));
            on = attacker.t > tm.H - 0.12 && attacker.t < tm.H + 0.1;
            fx.setHero(attacker.fig.root.position.clone().add(V3(0, 0.03, 0)), attacker.fig.root.position.clone().add(V3(0, 0.98 * attacker.fig.root.scale.x, 0)));
          }
        }
      }
      trail.on = on;
      if (on) { trail.base.copy(base); trail.tip.copy(tip); trail.heavy = attacker.atk.tier >= 3; trail.freeze = attacker.freeze; }
      if (o.shots) flyShots(now);
      fire?.step(now);
      const lit = sfx ? sfx.step(now, camera) : false;
      stepSmites(now, camera);
      const aiming = stepAim(dt);
      fx.update(dt);
      return !!(units.size || dying.length || queue.length || shots.length || smites.length || lit || aiming);
    }
    function setPixelRatio(dpr) { for (const u of units.values()) if (u.fig) R.setPixelRatio(u.fig, dpr); }
    function dispose() {
      disposed = true;
      for (const u of [...units.values(), ...dying]) { if (u.fig) { scene.remove(u.fig.root); R.dispose(u.fig); } dropBase(scene, u); }
      for (const s of smites) for (const m of [s.m.sword, s.m.sigil]) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
      for (const m of [aimAt.beam, aimAt.ret]) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
      units.clear(); dying.length = 0; queue.length = 0; shots.length = 0; smites.length = 0;
      sfx?.dispose();
    }
    return Object.freeze({
      set, drop, cue, contact, owns, plan, step, setPixelRatio, dispose, fx, aim,
      /** the camera shake the blows ask for now (world units; the page applies it) */
      shake: (now = performance.now()) => sfx?.shake(now) ?? 0,
      /** the camera's punch in toward a god's blow (× its distance) and how far the stage is dimmed round it (0 – 1) */
      punch: (now = performance.now()) => sfx?.punch(now) ?? 0,
      dim: (now = performance.now()) => sfx?.dim(now) ?? 0,
      /** something moves fast now (a blow, a death, a figure arriving, a shot, the aim): the page draws every frame;
       *  otherwise only idle breathing is on and it may draw at half rate */
      hot: () => {
        if (dying.length || shots.length || smites.length || aimAt.k > 0.01 || sfx?.hot()) return true;
        for (const u of units.values()) if (u.state !== "live" || u.clip !== "idle" || u.atk || u.kb || u.glow) return true;
        return false;
      },
      each: (fn) => units.forEach(fn),
      has: (side, uid) => units.has(key(side, uid)),
      unit: (side, uid) => units.get(key(side, uid)) || null,
      diagnostics: () => ({ ...stats, cues: stats.cues.slice(), dying: dying.length, baking: queue.length, live: [...units.values()].filter((u) => u.state === "live").length }),
    });
  }
  return Object.freeze({ create, key, TIER, REACH });
})();
