/* EmberSkillFx — the champions' signature effects for the realistic figures (docs/design/MINIATURES.md), made the way
 * a MOBA's skill effects are: layered, smooth (never pixel-stepped), light added over soft smoke and solid debris, and
 * every layer on its own clock — a flash that peaks in a frame and is gone in six, a shock front that runs out fast and
 * thins, fissures that glow and cool, spikes that burst from the ground and sink, sparks that fall, feathers, leaves,
 * snow and motes that linger. No textures: shaders draw
 *   sprites  camera-facing quads, instanced — glow · starburst · sparkle · feather · spark · flare line · shard · leaf ·
 *            snowflake · crescent · wisp · ring · star — and soft smoke (alpha, a second pool)
 *   solids   shaded rocks (tumbling debris) and spikes (ice, stone, thorn) that erupt from the ground
 *   decals   on the ground — fissures, scorch, shock ring, sigils (sun · moon · star · rune · leaf), frost, void
 *   beams    upright columns of light
 *   ribbons  the weapon's swoosh, sampled from the posed weapon every frame
 * Each signature figure carries a recipe (SUITES[id].sig.fx in EmberModelFigures: its palette, what charges, what its
 * blow leaves, how it guards, how it triumphs, what hangs round it at rest); the arena calls
 *   const sfx = EmberSkillFx.create({ add(mesh), remove(mesh), fire (an EmberFire system), hand(u) → the casting point,
 *                                     halo (false: no idle sigil on the station — the page draws its own) })
 *   sfx.attack(u, plan)          the attack is cued: { t0, align (ms to the blow / the release), tier, leap, target() →
 *                                { ground, center } of the foe }
 *   sfx.impact(u, hit, tier)     the director's contact on its victim: { at (victim centre), ground, dir (attacker →
 *                                victim, flat) }
 *   sfx.hurt(u, from) · sfx.victory(u) · sfx.frame(u, now) (after the figure is posed) · sfx.step(now, camera)
 *   sfx.shake(now) → camera shake (world units) · sfx.drop(u) · sfx.dispose()
 * u is the arena's unit: its figure (u.fig: root, sig, blade [root, point], bladeK), clip, station (u.pos).
 * Pure presentation: never reads or changes game state. */
const EmberSkillFx = (() => {
  const THREE = EmberVesperThree, V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const ADD = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
  const OVER = { transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor };
  const NOISE = /* glsl */ `
    float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n21(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n21(p); p = p * 2.07 + 17.3; a *= 0.5; } return s; }
    vec2 h22(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
    float cells(vec2 p, float seed) {                     // distance to the nearest cell edge
      vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y), o = h22(i + g + seed); float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      return d2 - d1;
    }`;

  // ------------------------------------------------------------------ sprites (instanced camera-facing quads)
  // per instance: aP centre · aD (size, turn, strength, shape | smoke seed) · aC colour (linear, > 1 burns) · aV a
  // streak's stretch (world vector: the quad is drawn along it, as long as it is on screen)
  const SPRITE_VS = /* glsl */ `
    attribute vec3 aP, aC, aV; attribute vec4 aD;
    varying vec2 vQ; varying vec3 vC; varying float vK, vS;
    void main() {
      vQ = position.xy * 2.0; vC = aC; vK = aD.z; vS = aD.w;
      vec4 mv = viewMatrix * vec4(aP, 1.0);
      vec3 vv = (viewMatrix * vec4(aV, 0.0)).xyz; float L = length(vv.xy);
      if (L > 1e-5) { vec2 d = vv.xy / L; mv.xy += d * position.x * (aD.x + L) + vec2(-d.y, d.x) * position.y * aD.x; }
      else { float c = cos(aD.y), s = sin(aD.y); mv.xy += vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aD.x; }
      gl_Position = projectionMatrix * mv;
    }`;
  // shapes: 0 glow · 1 starburst · 2 sparkle · 3 feather · 4 spark · 5 flare · 6 shard · 7 leaf · 8 snowflake ·
  // 9 crescent · 10 wisp · 11 ring · 12 star · 13 sword of light · 14 crisp blade · 15 rift · 16 speed lines · 17 arc
  const SPRITE_FS = /* glsl */ `
    varying vec2 vQ; varying vec3 vC; varying float vK, vS;
    float h1(float x) { return fract(sin(x * 127.1 + 3.7) * 43758.5453); }
    float n1(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453), b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5453);
      float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5453), d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5453);
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
    void main() {
      vec2 q = vQ; float r = length(q), k = 0.0, a = atan(q.y, q.x), fill = -1.0; vec3 tint = vC;
      if (vS < 0.5) {                                   // glow: a soft ball, hot at the heart
        k = (exp(-r * r * 5.0) * 0.7 + exp(-r * r * 28.0) * 0.9) * (1.0 - smoothstep(0.8, 1.0, r));
      } else if (vS < 1.5) {                            // starburst: six long rays, six short, a core
        float ray = pow(abs(cos(a * 3.0)), 70.0) + 0.45 * pow(abs(sin(a * 3.0)), 110.0);
        k = ray * exp(-r * 2.4) * (1.0 - r) * 1.3 + exp(-r * r * 24.0) * 1.3 + exp(-r * r * 4.0) * 0.18;
        k *= 1.0 - smoothstep(0.9, 1.0, r);
      } else if (vS < 2.5) {                            // sparkle: a point with a four-point glint
        float g = exp(-abs(q.x) * 28.0) * exp(-abs(q.y) * 2.6) + exp(-abs(q.y) * 28.0) * exp(-abs(q.x) * 2.6);
        k = (exp(-r * 8.0) * 1.2 + 0.8 * g) * (1.0 - smoothstep(0.8, 1.0, r));
      } else if (vS < 3.5) {                            // feather: a shaft, a vane either side of it, barbed
        float y = q.y * 1.05, x = q.x, t = (y + 0.95) / 1.9;
        float w = 0.34 * pow(max(0.0, sin(3.14159 * clamp(t, 0.0, 1.0))), 0.55) * (1.0 - 0.35 * t);
        float inside = (1.0 - smoothstep(w - 0.06, w, abs(x))) * step(-0.62, y) * step(y, 0.95);
        float barb = smoothstep(0.15, 0.55, abs(fract((y - abs(x) * 1.1) * 13.0) - 0.5) * 2.0);
        float shaft = exp(-abs(x) * 55.0) * step(-0.95, y) * step(y, 0.9);
        k = inside * (0.35 + 0.45 * barb) * (0.55 + 0.45 * abs(x) / max(w, 0.01)) + shaft * 1.2;
        tint = mix(vC, vec3(1.6, 1.5, 1.3), shaft * 0.7);
      } else if (vS < 4.5) {                            // spark: a streak, hottest along its middle
        k = exp(-q.y * q.y * 14.0) * (1.0 - smoothstep(0.2, 1.0, abs(q.x))) * 1.4;
      } else if (vS < 5.5) {                            // flare: a thin bright line (a lens streak, a slash mark)
        k = (exp(-abs(q.y) * 34.0) * (1.0 - abs(q.x) * abs(q.x)) + exp(-r * r * 9.0) * 0.35) * (1.0 - smoothstep(0.9, 1.0, abs(q.x)));
      } else if (vS < 6.5) {                            // shard: a crystal splinter, one face lit, its edge bright
        float d = abs(q.x) / 0.3 + abs(q.y);
        k = (1.0 - smoothstep(0.88, 1.0, d)) * (0.3 + 0.4 * step(0.0, q.x) + 0.3 * (1.0 - abs(q.y))) + exp(-abs(d - 0.93) * 28.0) * 0.8;
      } else if (vS < 7.5) {                            // leaf: a blade with its midrib and veins, a stem
        float t = (q.y + 0.85) / 1.75, w = 0.4 * pow(max(0.0, sin(3.14159 * clamp(t, 0.0, 1.0))), 0.8);
        float inside = (1.0 - smoothstep(w - 0.05, w, abs(q.x))) * step(-0.85, q.y) * step(q.y, 0.9);
        float vein = smoothstep(0.75, 1.0, abs(fract((q.y - abs(q.x) * 0.9) * 7.0) - 0.5) * 2.0);
        k = inside * (0.5 + 0.35 * vein + 0.5 * exp(-abs(q.x) * 40.0)) + exp(-abs(q.x) * 50.0) * step(-1.0, q.y) * step(q.y, -0.8) * 0.6;
      } else if (vS < 8.5) {                            // snowflake: six arms, each with a pair of branches
        float s6 = abs(sin(a * 3.0)), arm = exp(-s6 * r * 22.0) * (1.0 - smoothstep(0.7, 0.9, r));
        float b = exp(-abs(sin((a + 0.5236) * 3.0)) * r * 14.0) * smoothstep(0.3, 0.4, r) * (1.0 - smoothstep(0.55, 0.65, r));
        k = arm + 0.6 * b + exp(-r * r * 40.0) * 0.8;
      } else if (vS < 9.5) {                            // crescent: a new moon's sickle, its edge bright
        float d = max(length(q) - 0.85, -(length(q - vec2(0.3, 0.14)) - 0.74));
        k = ((1.0 - smoothstep(-0.02, 0.03, d)) * 0.7 + exp(-abs(d) * 26.0) * 0.6 + exp(-max(d, 0.0) * 7.0) * 0.2) * (1.0 - smoothstep(0.8, 1.0, r));
      } else if (vS < 10.5) {                           // wisp: a soft head with a long tail behind it (drawn along its flight)
        k = exp(-q.y * q.y * 9.0) * (q.x > 0.0 ? exp(-q.x * q.x * 18.0) : exp(-q.x * q.x * 1.6)) * (1.0 - smoothstep(0.85, 1.0, abs(q.x))) * 1.2;
      } else if (vS < 11.5) {                           // ring: a hollow circle (a shock seen head-on)
        k = exp(-abs(r - 0.78) * 22.0) * (1.0 - smoothstep(0.93, 1.0, r)) * 1.2;
      } else if (vS < 12.5) {                           // star: five points, a glow
        float rr = 0.42 + 0.5 * pow(0.5 + 0.5 * cos(a * 5.0 - 1.5708 * 5.0), 4.0);
        k = ((1.0 - smoothstep(rr - 0.06, rr, r)) * 0.9 + exp(-r * r * 6.0) * 0.4) * (1.0 - smoothstep(0.85, 1.0, r));
      } else if (vS < 13.5) {                           // sword of light: its point leading (+x), a cross-guard, a grip
        float x = q.x, y = q.y, w = 0.15 * (1.0 - smoothstep(0.35, 0.95, x));
        float blade = (1.0 - smoothstep(w * 0.55, w + 0.005, abs(y))) * step(-0.45, x) * step(x, 0.95);
        float guard = (1.0 - smoothstep(0.03, 0.06, abs(x + 0.5))) * (1.0 - smoothstep(0.28, 0.34, abs(y)));
        float grip = (1.0 - smoothstep(0.025, 0.045, abs(y))) * step(-0.85, x) * step(x, -0.5);
        float core = exp(-abs(y) * 45.0) * step(-0.45, x) * step(x, 0.9);
        k = (blade * 0.75 + guard * 0.7 + grip * 0.5 + core * 0.9 + exp(-length(vec2(x * 0.6, y * 2.5)) * 4.0) * 0.25) * (1.0 - smoothstep(0.92, 1.0, abs(x)));
      } else if (vS < 14.5) {                           // blade: a crisp blade of light, point leading (+x) — hard edges, a white ridge
        float x = q.x, y = q.y, w = 0.12 * (1.0 - smoothstep(0.42, 0.98, x)) * step(-0.5, x);
        float body = 1.0 - smoothstep(w - 0.012, w, abs(y));
        float ridge = exp(-abs(y) * 90.0) * step(-0.5, x) * step(x, 0.93);
        float guard = (1.0 - smoothstep(0.018, 0.03, abs(x + 0.53))) * (1.0 - smoothstep(0.19, 0.22, abs(y)));
        float grip = (1.0 - smoothstep(0.018, 0.028, abs(y))) * step(-0.8, x) * step(x, -0.53);
        k = body * 0.5 + ridge * 1.15 + guard * 0.85 + grip * 0.55;
        tint = mix(vC, vec3(1.8, 1.7, 1.5), ridge * 0.8);
      } else if (vS < 15.5) {                           // rift: a torn vertical slit, its lips burning, the dark inside it
        float jag = n1(vec2(q.y * 7.0, 1.3)), off = 0.08 * (n1(vec2(q.y * 4.0, 7.1)) - 0.5);
        float w = 0.26 * pow(max(0.0, 1.0 - abs(q.y)), 1.3) * (0.65 + 0.7 * jag);
        float d = abs(q.x + off) - w;
        fill = (1.0 - smoothstep(-0.012, 0.01, d)) * step(abs(q.y), 0.98);
        k = exp(-abs(d) * 55.0) * step(abs(q.y), 0.97) * 1.2 + fill * 0.1;
      } else if (vS < 16.5) {                           // speed lines: thin rays converging on the centre, which stays clear
        float t = (a + 3.14159) * 44.0 / 6.2832, seg = floor(t), hv = h1(seg), f = fract(t);
        float thin = 1.0 - smoothstep(0.0, 0.08 + 0.22 * hv, abs(f - 0.5) * 2.0), r0 = 0.38 + 0.45 * h1(seg + 17.0);
        k = thin * smoothstep(r0, r0 + 0.1, r) * (1.0 - smoothstep(0.88, 1.0, r)) * step(0.35, hv) * 1.25;
      } else if (vS < 17.5) {                           // arc: a thin, crisp crescent (a slash of moonlight), thickest at -x
        float d = max(length(q) - 0.9, -(length(q - vec2(0.16, 0.0)) - 0.86));
        k = (1.0 - smoothstep(-0.006, 0.012, d)) * 0.95 + exp(-max(d, 0.0) * 45.0) * 0.2;
        fill = 1.0 - smoothstep(-0.006, 0.012, d);
      } else {                                          // cut: a crisp sliver of light, tapering to both ends (a blade's mark)
        float w = 0.045 * (1.0 - q.x * q.x);
        k = (1.0 - smoothstep(w * 0.6, w, abs(q.y))) * (1.0 - smoothstep(0.9, 1.0, abs(q.x))) + exp(-abs(q.y) * 38.0) * 0.18 * (1.0 - q.x * q.x);
        tint = mix(vC, vec3(1.7, 1.6, 1.4), 1.0 - smoothstep(0.0, w * 0.5, abs(q.y)));
      }
      k *= vK;
      #ifdef DARK
      float al = clamp((fill >= 0.0 ? fill : k), 0.0, 1.0) * vK;              // a solid dark shape laid over (premultiplied)
      gl_FragColor = vec4(linearToOutputTexel(vec4(tint, 1.0)).rgb * al, al);
      #else
      vec3 col = tint * k + vec3(1.0) * max(0.0, k - 1.0) * 0.6;          // what burns past 1 goes white
      gl_FragColor = linearToOutputTexel(vec4(col, 0.0));
      #endif
    }`;
  const SMOKE_FS = /* glsl */ `
    uniform float uTime; varying vec2 vQ; varying vec3 vC; varying float vK, vS;
    ${NOISE}
    void main() {
      float r = length(vQ), n = fbm(vQ * 1.7 + vec2(vS * 13.1, vS * 7.7 - uTime * 0.3));
      float a = (1.0 - smoothstep(0.3, 1.0, r + (n - 0.5) * 0.6)) * vK;
      vec3 c = linearToOutputTexel(vec4(vC * (0.7 + 0.6 * n), 1.0)).rgb;
      gl_FragColor = vec4(c * a, a);
    }`;
  const QUAD = new THREE.PlaneGeometry(1, 1);
  const SHAPE = { glow: 0, star: 1, sparkle: 2, feather: 3, spark: 4, flare: 5, shard: 6, leaf: 7, snow: 8, crescent: 9, wisp: 10, ring: 11, star5: 12, sword: 13, blade: 14, rift: 15, lines: 16, arc: 17, cut: 18 };
  // mode: "add" (light) · "smoke" (soft billows, over) · "dark" (solid dark shapes laid over: the contrast a modern
  // effect keeps — a dark core under the light, black speed lines, the inside of a rift)
  function pool(N, mode) {
    const smoke = mode === "smoke", dark = mode === "dark";
    const g = new THREE.InstancedBufferGeometry();
    g.index = QUAD.index; g.setAttribute("position", QUAD.attributes.position); g.setAttribute("uv", QUAD.attributes.uv);
    const at = { aP: 3, aD: 4, aC: 3, aV: 3 }, A = {};
    for (const [k, n] of Object.entries(at)) { A[k] = new THREE.InstancedBufferAttribute(new Float32Array(N * n), n).setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, A[k]); }
    g.instanceCount = 0;
    const m = new THREE.ShaderMaterial({ vertexShader: SPRITE_VS, fragmentShader: smoke ? SMOKE_FS : SPRITE_FS, uniforms: { uTime: { value: 0 } }, depthTest: false, ...(smoke || dark ? OVER : ADD), defines: dark ? { DARK: "" } : {} });
    m.userData.toScreen = true;
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false; mesh.renderOrder = smoke ? 12 : dark ? 16 : 17;
    return { mesh, A, N, P: [] };
  }
  // how a sprite's strength runs over its life (u 0 → 1)
  const ENV = {
    flash: (u) => Math.min(1, u / 0.06) * (1 - u) * (1 - u),
    pop: (u) => Math.min(1, u / 0.15) * (1 - u),
    mote: (u) => Math.sin(Math.PI * Math.min(1, u)),
    late: (u) => Math.min(1, u / 0.1) * (u < 0.65 ? 1 : 1 - (u - 0.65) / 0.35),
    hold: (u) => Math.min(1, u / 0.12) * (u < 0.75 ? 1 : 1 - (u - 0.75) / 0.25),
    grow: (u) => Math.min(1, u / 0.7) * (u < 0.85 ? 1 : 1 - (u - 0.85) / 0.15),
    fade: (u) => 1 - u,
    on: () => 1,                                        // held by its owner (who sets its strength and puts it out)
  };
  const easeOut = (x) => 1 - (1 - x) * (1 - x);
  const _s = V3();
  function syncPool(pl, now, dt) {
    let n = 0;
    for (let i = pl.P.length - 1; i >= 0; i--) {
      const p = pl.P[i], u = (now - p.t0) / p.life;
      if (u >= 1) { pl.P.splice(i, 1); continue; }
      if (u < 0) continue;
      if (dt > 0) {
        p.v.y -= (p.grav || 0) * dt;
        if (p.drag) p.v.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        if (p.seek) { p.seek.updateWorldMatrix(true, false); p.seek.getWorldPosition(_s); p.v.addScaledVector(_s.sub(p.p), p.seekK * dt); }
        p.p.addScaledVector(p.v, dt);
        if (p.sway) p.p.x += Math.sin(now * 0.004 + p.seed * 9) * p.sway * dt;
        if (p.pull) p.p.lerp(p.pull, Math.min(1, dt * p.pullK));
        if (p.floor != null && p.p.y < p.floor) { p.p.y = p.floor; p.v.y = Math.abs(p.v.y) * 0.25; p.v.x *= 0.5; p.v.z *= 0.5; }
      }
      if (p.track) { p.track.updateWorldMatrix(true, false); p.track.getWorldPosition(p.p); if (p.off) p.p.add(p.off); }
      if (n >= pl.N) continue;
      const s = p.s0 + (p.s1 - p.s0) * easeOut(u);
      pl.A.aP.array.set([p.p.x, p.p.y, p.p.z], n * 3);
      pl.A.aD.array.set([s, p.rot + (p.spin || 0) * (now - p.t0) / 1000, p.k * ENV[p.env](u), p.shape], n * 4);
      pl.A.aC.array.set(p.col, n * 3);
      const st = p.stretch || 0;
      pl.A.aV.array.set(st ? [p.v.x * st, p.v.y * st, p.v.z * st] : [0, 0, 0], n * 3);
      n++;
    }
    pl.mesh.geometry.instanceCount = n;
    for (const a of Object.values(pl.A)) a.needsUpdate = true;
  }

  // ------------------------------------------------------------------ solids: rocks and spikes (instanced, shaded)
  // flat-shaded from the screen-space derivatives, a key from the upper left, a coloured rim (aE) that ice and hot
  // stone glow with
  const SOLID_VS = /* glsl */ `
    attribute vec3 aC, aE; varying vec3 vC, vE, vV;
    void main() { vC = aC; vE = aE; vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0); vV = mv.xyz; gl_Position = projectionMatrix * mv; }`;
  const SOLID_FS = /* glsl */ `
    varying vec3 vC, vE, vV;
    void main() {
      vec3 n = normalize(cross(dFdx(vV), dFdy(vV)));
      float l = 0.35 + 0.75 * max(dot(n, normalize(vec3(-0.45, 0.75, 0.5))), 0.0), rim = pow(1.0 - abs(n.z), 2.0);
      gl_FragColor = linearToOutputTexel(vec4(vC * l + vE * (0.35 + rim), 1.0));
    }`;
  function solids(N, geo) {
    const g = geo.clone();
    const aC = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage), aE = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aC", aC); g.setAttribute("aE", aE);
    const m = new THREE.ShaderMaterial({ vertexShader: SOLID_VS, fragmentShader: SOLID_FS, depthTest: true, depthWrite: true });
    m.userData.toScreen = true;
    const mesh = new THREE.InstancedMesh(g, m, N);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0; mesh.renderOrder = 3;
    return { mesh, aC, aE, N, P: [] };
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _sc = V3(), _up = V3(0, 1, 0);
  function syncRocks(pl, now, dt) {
    let n = 0;
    for (let i = pl.P.length - 1; i >= 0; i--) {
      const p = pl.P[i], u = (now - p.t0) / p.life;
      if (u >= 1) { pl.P.splice(i, 1); continue; }
      if (u < 0) continue;
      if (dt > 0) {
        p.v.y -= p.grav * dt; p.p.addScaledVector(p.v, dt); p.rot += p.spin * dt;
        const h = p.size * 0.5;
        if (p.p.y < h) { p.p.y = h; if (p.v.y < -0.3) { p.v.y *= -0.3; p.v.x *= 0.6; p.v.z *= 0.6; p.spin *= 0.5; } else { p.v.set(0, 0, 0); p.spin *= 0.9; } }
      }
      if (n >= pl.N) continue;
      const sink = u > 0.8 ? (u - 0.8) / 0.2 : 0;
      _q.setFromAxisAngle(p.axis, p.rot);
      pl.mesh.setMatrixAt(n, _m.compose(_sc.copy(p.p).setY(p.p.y - sink * p.size), _q, V3(p.size, p.size * 0.8, p.size)));
      pl.aC.array.set(p.col, n * 3); pl.aE.array.set(p.emit, n * 3);
      n++;
    }
    pl.mesh.count = n; pl.mesh.instanceMatrix.needsUpdate = true; pl.aC.needsUpdate = true; pl.aE.needsUpdate = true;
  }
  // a spike bursts out of the ground (overshooting a little), stands, and sinks back
  function syncSpikes(pl, now) {
    let n = 0;
    for (let i = pl.P.length - 1; i >= 0; i--) {
      const p = pl.P[i], u = (now - p.t0) / p.life;
      if (u >= 1) { pl.P.splice(i, 1); continue; }
      if (u < 0 || n >= pl.N) continue;
      const g = Math.min(1, (now - p.t0) / p.grow), back = 1 + 2.2 * (g - 1) ** 3 + 1.2 * (g - 1) ** 2;   // ease-out-back
      const h = p.h * (u < 0.8 ? back : 1 - (u - 0.8) / 0.2);
      _q.setFromUnitVectors(_up, p.dir); _q2.setFromAxisAngle(_up, p.twist); _q.multiply(_q2);
      pl.mesh.setMatrixAt(n, _m.compose(p.p, _q, _sc.set(p.w, Math.max(0.001, h), p.w)));
      pl.aC.array.set(p.col, n * 3); pl.aE.array.set(p.emit, n * 3);
      n++;
    }
    pl.mesh.count = n; pl.mesh.instanceMatrix.needsUpdate = true; pl.aC.needsUpdate = true; pl.aE.needsUpdate = true;
  }

  // ------------------------------------------------------------------ decals (ground quads, +y up)
  const DECAL_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  // fissures: jagged cracks run out from the centre (their tips reached as uGrow → 1), a shattered heart; they burn
  // at uHot, cool through uMid to uCool from the tips inward (uAge), a glow along them. uRoot: roots instead — more,
  // thinner, wandering further
  const CRACK_FS = /* glsl */ `
    uniform float uAge, uGrow, uK, uSeed, uRoot; uniform vec3 uHot, uMid, uCool; varying vec2 vUv;
    ${NOISE}
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x), line = 0.0, glow = 0.0;
      for (int i = 0; i < 12; i++) {
        if (uRoot < 0.5 && i >= 9) break;
        float fi = float(i), ang = fi * (uRoot > 0.5 ? 0.5236 : 0.698) + (h21(vec2(fi, uSeed)) - 0.5) * 0.5;
        float len = (0.55 + 0.45 * h21(vec2(fi * 3.7, uSeed + 1.0))) * uGrow;
        float wob = (fbm(vec2(r * 5.0, fi * 5.3 + uSeed)) - 0.5) * (0.6 + 0.5 * uRoot) + (n21(vec2(r * 14.0, fi * 9.1)) - 0.5) * 0.05;
        float da = a - ang - wob; da = atan(sin(da), cos(da));
        float d = abs(da) * r, on = step(r, len) * smoothstep(0.02, 0.1, r);
        float w = (0.034 - 0.014 * uRoot) * pow(1.0 - r / max(len, 0.01), 1.4) + 0.003;
        line = max(line, (1.0 - smoothstep(w * 0.35, w, d)) * on);
        glow = max(glow, exp(-d / (w * 3.5)) * on * (1.0 - r / max(len, 0.01)));
      }
      float heart = (1.0 - smoothstep(0.035, 0.07, cells(p * 7.0, uSeed))) * (1.0 - smoothstep(0.12, 0.3, r)) * step(0.03, r) * (1.0 - uRoot);
      line = max(line, heart);
      float heat = clamp(1.0 - uAge * 1.25 - r * 0.6 * uAge, 0.0, 1.0);                        // the tips cool first
      vec3 hot = mix(uCool, uMid, smoothstep(0.15, 0.6, heat));
      hot = mix(hot, uHot, smoothstep(0.8, 1.0, heat));
      float fade = 1.0 - smoothstep(0.55, 1.0, uAge);
      vec3 c = hot * line * 1.1 + mix(uCool, hot, 0.5) * glow * 0.5 * (0.3 + 0.7 * heat) + uMid * exp(-r * 8.0) * 0.5 * heat;
      gl_FragColor = linearToOutputTexel(vec4(c * uK * fade * (1.0 - smoothstep(0.92, 1.0, r)), 0.0));
    }`;
  const SCORCH_FS = /* glsl */ `
    uniform float uK; uniform vec3 uTint; varying vec2 vUv;
    ${NOISE}
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), n = fbm(p * 3.0 + 4.0);
      float a = (1.0 - smoothstep(0.25, 0.95, r + (n - 0.5) * 0.35)) * uK * 0.55;
      gl_FragColor = vec4(uTint * a, a);
    }`;
  // a shock front: a thin bright ring racing out (uU 0 → 1), thinning and dimming, broken a little
  const SHOCK_FS = /* glsl */ `
    uniform float uU, uK; uniform vec3 uTint; varying vec2 vUv;
    ${NOISE}
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      float R = 0.22 + 0.76 * (1.0 - pow(1.0 - uU, 3.0)), th = 0.06 * (1.0 - uU) + 0.012;
      float ring = exp(-pow((r - R) / th, 2.0)) * (0.75 + 0.35 * n21(vec2(a * 5.0, uU * 3.0)));
      float k = ring * (1.0 - uU) * (1.0 - uU) * uK;
      vec3 c = uTint * k + vec3(1.0) * ring * max(0.0, 0.5 - uU) * 0.35 * uK;
      gl_FragColor = linearToOutputTexel(vec4(c * (1.0 - smoothstep(0.96, 1.0, r)), 0.0));
    }`;
  // sigils, turning (uStyle): 0 sun (twelve rays) · 1 moon (a crescent in the heart) · 2 star (an eight-point star) ·
  // 3 rune (a hexagram) · 4 leaf (a wreath of twelve leaves); each inside rings and a band of runes
  const SIGIL_FS = /* glsl */ `
    uniform float uK, uRot, uStyle; uniform vec3 uTint; varying vec2 vUv;
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      float ring = exp(-abs(r - 0.95) * 110.0) + 0.9 * exp(-abs(r - 0.78) * 130.0) + 0.6 * exp(-abs(r - 0.36) * 120.0);
      // edges a pixel soft (fwidth), radially and round the circle: a hard step crawls as the sigil turns
      float aa = max(fwidth(r), 1e-4), px = length(fwidth(p)) / max(r, 1e-3) / 6.2832;
      float ar = a + uRot, w1 = 40.0 * px, w2 = 120.0 * px;
      float runes = smoothstep(0.8 - aa, 0.8 + aa, r) * (1.0 - smoothstep(0.92 - aa, 0.92 + aa, r))
        * (1.0 - smoothstep(0.275 - w1, 0.275 + w1, abs(fract(ar * 40.0 / 6.2832) - 0.725)))
        * (1.0 - smoothstep(0.325 - w2, 0.325 + w2, abs(fract(ar * 120.0 / 6.2832 + 0.4 * sin(ar * 9.0)) - 0.675)));
      float inner = 0.0, ai = a - uRot * 0.5;
      if (uStyle < 0.5) {
        float f = abs(fract(ai * 12.0 / 6.2832) - 0.5) * 2.0;
        inner = (1.0 - smoothstep(0.0, 0.14 * (1.0 - smoothstep(0.38, 0.76, r)) + 24.0 * px, f)) * smoothstep(0.38 - aa, 0.38 + aa, r) * (1.0 - smoothstep(0.76 - aa, 0.76 + aa, r));
      } else if (uStyle < 1.5) {
        vec2 q = vec2(cos(ai), sin(ai)) * r;
        float d = max(length(q) - 0.62, -(length(q - vec2(0.2, 0.08)) - 0.55));
        inner = exp(-abs(d) * 70.0) + (1.0 - smoothstep(-0.01, 0.01, d)) * 0.35;
      } else if (uStyle < 2.5) {
        for (int k = 0; k < 4; k++) { float th = ai + float(k) * 0.7854; float d = abs(sin(th) * r); inner += exp(-d * 90.0) * (1.0 - smoothstep(0.2, 0.76, r)) * (k % 2 == 0 ? 1.0 : 0.6); }
      } else if (uStyle < 3.5) {
        for (int k = 0; k < 6; k++) { float th = ai + float(k) * 1.0472; vec2 n = vec2(cos(th), sin(th)); inner += exp(-abs(dot(p, n) - 0.36) * 110.0) * (1.0 - smoothstep(0.76 - aa, 0.76 + aa, r)); }
      } else {
        float t = fract(ai * 12.0 / 6.2832) - 0.5, rl = (r - 0.56) / 0.17;
        inner = (1.0 - smoothstep(0.75, 1.0, length(vec2(t * 3.2, rl)))) * 0.6 + exp(-abs(t) * 40.0) * (1.0 - smoothstep(0.9 - aa / 0.17, 0.9 + aa / 0.17, abs(rl))) * 0.5;
      }
      float c = ring + 0.8 * inner + 0.5 * runes + 0.4 * exp(-r * 5.0);
      gl_FragColor = linearToOutputTexel(vec4(uTint * c * uK * (1.0 - smoothstep(0.97, 1.0, r)), 0.0));
    }`;
  // frost: rime spreading out (uGrow), crystal cells and six long needles, white at the heart, blue at the rim
  const FROST_FS = /* glsl */ `
    uniform float uAge, uGrow, uK, uSeed; uniform vec3 uHot, uMid; varying vec2 vUv;
    ${NOISE}
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      float reach = uGrow * (0.75 + 0.25 * fbm(vec2(a * 3.0, uSeed)));
      float inside = 1.0 - smoothstep(reach - 0.12, reach, r);
      float cr = 1.0 - smoothstep(0.02, 0.06, cells(p * 8.0, uSeed));
      float needles = 0.0;
      for (int i = 0; i < 6; i++) { float th = float(i) * 1.0472 + uSeed; vec2 n = vec2(-sin(th), cos(th)), d = vec2(cos(th), sin(th));
        float along = dot(p, d); needles += exp(-abs(dot(p, n)) * 120.0) * step(0.0, along) * (1.0 - smoothstep(0.5, 1.0, along / max(reach, 0.01))); }
      float fade = 1.0 - smoothstep(0.5, 1.0, uAge);
      vec3 c = mix(uMid, uHot, 1.0 - smoothstep(0.0, 0.6, r)) * (cr * 0.55 + needles * 0.9 + 0.22 * (1.0 - smoothstep(0.0, reach, r)));
      gl_FragColor = linearToOutputTexel(vec4(c * inside * fade * uK, 0.0));
    }`;
  // void: a dark pool swirling inward (alpha), laid under a glowing rim
  const VOID_FS = /* glsl */ `
    uniform float uK, uRot; varying vec2 vUv;
    ${NOISE}
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      float sw = fbm(vec2(a * 2.0 + r * 5.0 - uRot * 2.0, r * 3.0 + uRot));
      float d = (1.0 - smoothstep(0.45, 1.0, r + (sw - 0.5) * 0.35)) * uK;
      gl_FragColor = vec4(vec3(0.02, 0.0, 0.04) * d, d * 0.8);
    }`;
  // an area marked for the blow (a MOBA's skill indicator): a crisp rim, ticks turning inside it, a fill that sweeps out
  // from the centre as the charge builds (uFill 0 → 1), its front a bright line
  const ZONE_FS = /* glsl */ `
    uniform float uK, uFill, uRot; uniform vec3 uTint; varying vec2 vUv;
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x);
      float rim = 1.0 - smoothstep(0.012, 0.028, abs(r - 0.955));
      float fill = (1.0 - smoothstep(uFill - 0.015, uFill, r)) * step(r, 0.95);
      float front = exp(-abs(r - uFill) * 70.0) * step(r, 0.95) * step(0.03, uFill) * (1.0 - step(0.985, uFill));
      float ticks = step(0.84, r) * step(r, 0.9) * step(0.55, fract((a + uRot) * 30.0 / 6.2832));
      float c = rim * 0.9 + fill * (0.035 + 0.12 * r * r) + front * 0.8 + ticks * 0.3;
      gl_FragColor = linearToOutputTexel(vec4(uTint * c * uK, 0.0));
    }`;
  // a god's blow runs through the board (after 万象棋's ultimates): a streak on the ground from the god's feet through
  // its target to far beyond it (uv.x along, uv.y across). At the blow it is revealed to the target at once, then its
  // front (uFront) runs on to the end, a bright head riding it; it burns, cools (uAge) and fades, leaving a scorch
  // (alpha) that goes last. uStyle: 0 a cut of light (straight, no scorch) · 1 a molten fissure · 2 a rift (a dark
  // tear, its lips lit) · 3 roots splitting the ground
  const STREAK_FS = /* glsl */ `
    uniform float uAge, uFront, uK, uSeed, uStyle, uLen; uniform vec3 uHot, uMid, uCool; varying vec2 vUv;
    ${NOISE}
    void main() {
      float x = vUv.x, y = (vUv.y - 0.5) * 2.0, L = uLen;
      float wob = (fbm(vec2(x * L * 1.4, uSeed)) - 0.5) * (uStyle < 0.5 ? 0.1 : uStyle > 2.5 ? 0.7 : 0.45);
      float d = abs(y - wob), aa = max(fwidth(d), 1e-4);
      float w = (uStyle < 0.5 ? 0.07 : 0.13) * (0.7 + 0.6 * n21(vec2(x * L * 3.0, uSeed + 2.0)));
      float reach = 1.0 - smoothstep(uFront - 0.015, uFront, x);
      float ends = smoothstep(0.0, 0.05, x) * (1.0 - smoothstep(0.86, 1.0, x));
      float heat = clamp(1.0 - uAge * 1.5, 0.0, 1.0);
      float core = 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, d);
      float glow = exp(-d / (w * 2.4));
      float head = exp(-max(0.0, uFront - x) * 9.0) * reach * (1.0 - step(0.999, uFront)) * 1.6;
      float ember = step(0.965, h21(floor(vec2(x * L * 16.0, (y - wob) * 5.0)) + uSeed)) * (1.0 - smoothstep(0.2, 0.7, d)) * heat;
      vec3 hot = mix(uCool, uMid, smoothstep(0.1, 0.55, heat)); hot = mix(hot, uHot, smoothstep(0.72, 1.0, heat));
      vec3 c = hot * (core * 1.3 + glow * 0.5 * (0.25 + 0.75 * heat)) + uHot * head + uHot * ember * 0.8;
      float scorch = (1.0 - smoothstep(0.2, 0.95, d + (fbm(vec2(x * L * 2.0, y * 3.0) + uSeed) - 0.5) * 0.5)) * 0.6;
      if (uStyle > 1.5 && uStyle < 2.5) {        // the rift: dark inside, its lips burning
        float lip = exp(-abs(d - w * 0.55) / (w * 0.35));
        c = hot * lip * (0.6 + 0.8 * heat) + uHot * head; scorch = max(scorch, core * 0.9);
      }
      if (uStyle < 0.5) scorch = 0.0;
      float fade = 1.0 - smoothstep(0.55, 1.0, uAge), gone = 1.0 - smoothstep(0.8, 1.0, uAge);
      vec3 o = linearToOutputTexel(vec4(c, 1.0)).rgb;
      gl_FragColor = vec4(o * reach * ends * fade * uK, scorch * reach * ends * gone * uK);
    }`;
  const STRIP = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const DISC = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const SIGILS = { sun: 0, moon: 1, star: 2, rune: 3, leaf: 4 };

  // ------------------------------------------------------------------ beams (a column of light, turned to the camera)
  const BEAM_FS = /* glsl */ `
    uniform float uK, uTime, uSeed; uniform vec3 uTint; varying vec2 vUv;
    ${NOISE}
    void main() {
      float x = (vUv.x - 0.5) * 2.0, y = vUv.y;
      float body = exp(-x * x * 4.5), core = exp(-x * x * 70.0);
      float streak = 0.6 + 0.6 * fbm(vec2(x * 5.0 + uSeed, y * 2.5 - uTime * 3.0));
      float v = smoothstep(0.0, 0.04, y) * (1.0 - smoothstep(0.35, 1.0, y));
      vec3 c = (uTint * body * streak * 0.7 + vec3(1.3, 1.1, 0.8) * core) * v * uK;
      gl_FragColor = linearToOutputTexel(vec4(c, 0.0));
    }`;
  const COLUMN = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);

  // ------------------------------------------------------------------ mesh effects (a god's)
  // a vortex of flame: an open cylinder twisted as it rises, flaring out at the top, its sheet of fire scrolling up in
  // bands; it grows out of the ground (uGrow) and, as it ages, is eaten away by noise from the top down, a hot line
  // along the edge it burns back to
  const VORTEX_VS = /* glsl */ `
    uniform float uTime, uTwist, uR0, uR1, uGrow, uSpin; varying vec2 vUv;
    void main() {
      float y = position.y, ang = atan(position.z, position.x);
      float a = ang + y * uTwist + uTime * uSpin, r = mix(uR0, uR1, pow(y, 1.4)) * (1.0 + 0.07 * sin(y * 18.0 - uTime * 11.0 + ang * 2.0));
      vUv = vec2(ang / 6.2832 + 0.5, y);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(cos(a) * r, y * uGrow, sin(a) * r, 1.0);
    }`;
  const VORTEX_FS = /* glsl */ `
    uniform float uTime, uAge, uK, uSpin, uDark; uniform vec3 uHot, uMid, uCool; varying vec2 vUv;
    ${NOISE}
    void main() {
      float n = fbm(vec2(vUv.x * 7.0 + vUv.y * 3.0, vUv.y * 3.5 - uTime * 2.8));
      float band = smoothstep(0.3, 0.72, n + 0.28 * sin(vUv.x * 6.2832 * 3.0 + vUv.y * 9.0 - uTime * 7.0 * sign(uSpin)));
      float fy = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y));
      float e = n + 0.35 * (1.0 - vUv.y) - (uAge * 1.5 - 0.2);            // what is left as it burns out (the top first)
      float alive = smoothstep(0.0, 0.05, e), edge = (1.0 - smoothstep(0.0, 0.07, abs(e))) * step(0.02, uAge);
      vec3 c = mix(uCool, uMid, band); c = mix(c, uHot, smoothstep(0.62, 0.95, band * (0.6 + n)));
      if (uDark > 0.5) {                                // a sheet of dark smoke (laid over): the contrast round the fire
        float al = smoothstep(0.35, 0.8, n) * alive * fy * uK;
        gl_FragColor = vec4(linearToOutputTexel(vec4(uCool, 1.0)).rgb * al, al);
        return;
      }
      gl_FragColor = linearToOutputTexel(vec4((c * band * alive + uHot * edge * 0.6) * fy * uK, 0.0));
    }`;
  const TUBE = new THREE.CylinderGeometry(1, 1, 1, 40, 24, true).translate(0, 0.5, 0);
  // a black hole: a sphere, black and nearly opaque at its heart, its limb burning in its colour with swirling bands
  const HOLE_VS = /* glsl */ `varying vec3 vN, vV; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
  const HOLE_FS = /* glsl */ `
    uniform float uK, uTime; uniform vec3 uGlow, uDeep; varying vec3 vN, vV;
    ${NOISE}
    void main() {
      vec3 N = normalize(vN), V = normalize(vV); float f = 1.0 - abs(dot(N, V));
      float sw = fbm(vec2(atan(N.y, N.x) * 2.0 + uTime * 2.2 + f * 5.0, f * 3.0 - uTime * 0.8));
      vec3 c = mix(uDeep, uGlow, pow(f, 2.2) * (0.55 + 0.7 * sw));
      float al = mix(0.97, 0.8, pow(f, 3.0)) * uK;
      gl_FragColor = vec4(linearToOutputTexel(vec4(c, 1.0)).rgb * al, al);
    }`;
  const BALL = new THREE.SphereGeometry(1, 32, 16);

  // ------------------------------------------------------------------ the swoosh (a ribbon behind the weapon)
  // per vertex: aA (age 0 → 1, across 0 inner → 1 edge, along the path). The edge is a hot line on the point's path;
  // behind it the band is its colour, eaten by noise from the tail as it ages; a slow weapon draws nothing
  const RIB_VS = /* glsl */ `
    attribute vec3 aA; varying vec3 vA;
    void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const RIB_FS = /* glsl */ `
    uniform float uK, uTime; uniform vec3 uTint, uEdge; varying vec3 vA;
    ${NOISE}
    void main() {
      float a = vA.x, v = vA.y, L = vA.z;
      float n = fbm(vec2(L * 9.0 - uTime * 2.0, v * 3.0));
      float eat = smoothstep(a - 0.15, a + 0.2, n * 0.75 + v * 0.45);
      float edge = exp(-pow((1.0 - v) * 8.0, 2.0)), band = smoothstep(0.0, 1.0, v) * (0.25 + 0.75 * v * v);
      float k = pow(1.0 - a, 2.0) * eat;
      vec3 c = uTint * band * 0.38 + uEdge * edge * (1.0 - a) * 0.85;
      gl_FragColor = linearToOutputTexel(vec4(c * k * uK, 0.0));
    }`;
  const RIB_LIFE = 210, RIB_MAX = 72, SUB = 4;
  function ribbon(tint, edge, inner) {
    const V = RIB_MAX * SUB * 2, pos = new Float32Array(V * 3), at = new Float32Array(V * 3), idx = [];
    for (let i = 0; i < V / 2 - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("aA", new THREE.BufferAttribute(at, 3).setUsage(THREE.DynamicDrawUsage));
    g.setIndex(idx); g.setDrawRange(0, 0);
    const m = new THREE.ShaderMaterial({ vertexShader: RIB_VS, fragmentShader: RIB_FS, side: THREE.DoubleSide, depthTest: true, ...ADD,
      uniforms: { uK: { value: 1 }, uTime: { value: 0 }, uTint: { value: new THREE.Color(...tint) }, uEdge: { value: new THREE.Color(...edge) } } });
    m.userData.toScreen = true;
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 15;
    return { mesh, S: [], pos, at, open: true, inner };
  }
  const cr = (p0, p1, p2, p3, u, out) => {
    const u2 = u * u, u3 = u2 * u;
    for (const c of ["x", "y", "z"]) out[c] = 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3);
    return out;
  };
  function buildRibbon(R, now) {
    const age = (t) => (R.fast && now > R.fast ? (now - t) + (now - Math.max(t, R.fast)) : now - t);   // twice as fast once the blow landed
    while (R.S.length && age(R.S[0].t) > RIB_LIFE) R.S.shift();
    let v = 0, L = 0;
    const b = V3(), t = V3(), put = (bb, tt, a0, g, l) => {
      if (v >= R.pos.length / 3 - 1) return;
      const a = Math.min(1, Math.max(0, a0 / RIB_LIFE)), inner = bb.clone().lerp(tt, R.inner);
      R.pos.set([inner.x, inner.y, inner.z], v * 3); R.at.set([a + (1 - g) * (1 - a), 0, l], v * 3); v++;
      R.pos.set([tt.x, tt.y, tt.z], v * 3); R.at.set([a + (1 - g) * (1 - a), 1, l], v * 3); v++;
    };
    const S = R.S;
    for (let i = 0; i < S.length - 1; i++) {
      const p0 = S[Math.max(0, i - 1)], p1 = S[i], p2 = S[i + 1], p3 = S[Math.min(S.length - 1, i + 2)];
      for (let j = 0; j < SUB; j++) {
        const u = j / SUB;
        cr(p0.b, p1.b, p2.b, p3.b, u, b); cr(p0.tp, p1.tp, p2.tp, p3.tp, u, t);
        L += j ? 0 : p1.tp.distanceTo(p2.tp);
        put(b, t, age(p1.t + (p2.t - p1.t) * u), p1.g + (p2.g - p1.g) * u, L);
      }
    }
    if (S.length > 1) { const l = S[S.length - 1]; put(l.b, l.tp, age(l.t), l.g, L); }
    R.mesh.geometry.setDrawRange(0, Math.max(0, (v / 2 - 1) * 6));
    R.mesh.geometry.attributes.position.needsUpdate = true; R.mesh.geometry.attributes.aA.needsUpdate = true;
  }

  // ------------------------------------------------------------------ palettes (linear; > 1 burns toward white)
  // core: the flash's heart · glow: the light · deep: where it cools · trail: the swoosh's band · mote · dust (smoke) ·
  // rock (solid debris) · emit (a spike's glowing rim)
  const PAL = {
    holy: { core: [2.4, 2.2, 1.8], glow: [1.9, 1.35, 0.55], deep: [0.9, 0.18, 0.02], trail: [1.2, 0.68, 0.18], mote: [2.0, 1.25, 0.42], dust: [0.52, 0.46, 0.4] },
    sun: { core: [2.6, 2.0, 1.1], glow: [2.3, 0.95, 0.22], deep: [1.1, 0.12, 0.02], trail: [1.5, 0.55, 0.08], mote: [2.4, 0.9, 0.2], dust: [0.45, 0.36, 0.3] },
    dawn: { core: [2.6, 2.4, 2.1], glow: [2.1, 1.35, 0.8], deep: [1.2, 0.35, 0.3], trail: [1.3, 0.85, 0.5], mote: [2.2, 1.5, 0.9], dust: [0.55, 0.5, 0.46] },
    frost: { core: [2.2, 2.5, 2.8], glow: [0.7, 1.5, 2.6], deep: [0.1, 0.3, 1.0], trail: [0.5, 1.0, 1.8], mote: [1.3, 1.9, 2.6], dust: [0.72, 0.8, 0.9], rock: [0.62, 0.8, 0.98], emit: [0.35, 0.8, 1.6] },
    moon: { core: [2.1, 1.7, 2.7], glow: [1.0, 0.35, 1.8], deep: [0.4, 0.03, 0.55], trail: [0.75, 0.22, 1.3], mote: [1.5, 0.6, 2.2], dust: [0.2, 0.14, 0.26], blood: [2.0, 0.2, 0.35] },
    star: { core: [2.3, 2.5, 2.8], glow: [0.95, 1.3, 2.5], deep: [0.25, 0.3, 1.1], trail: [0.6, 0.85, 1.7], mote: [1.6, 1.9, 2.6], dust: [0.5, 0.52, 0.6] },
    wild: { core: [2.2, 2.6, 1.6], glow: [0.8, 1.9, 0.45], deep: [0.15, 0.6, 0.08], trail: [0.5, 1.25, 0.3], mote: [1.3, 2.2, 0.6], dust: [0.5, 0.47, 0.37], leaf: [0.7, 1.5, 0.35] },
    verdant: { core: [2.6, 2.5, 1.4], glow: [1.4, 1.9, 0.35], deep: [0.4, 0.75, 0.05], trail: [1.0, 1.35, 0.25], mote: [2.0, 2.1, 0.6], dust: [0.48, 0.44, 0.34], leaf: [1.0, 1.6, 0.3], rock: [0.3, 0.24, 0.14], emit: [0.35, 0.9, 0.1] },
    earth: { core: [2.3, 1.8, 1.1], glow: [1.6, 0.8, 0.3], deep: [0.7, 0.2, 0.04], trail: [0.9, 0.55, 0.25], mote: [0.6, 1.5, 2.6], dust: [0.56, 0.48, 0.4], rock: [0.42, 0.36, 0.3], emit: [0.3, 0.55, 1.1] },
    fire: { core: [2.7, 2.1, 1.1], glow: [2.5, 0.95, 0.15], deep: [1.2, 0.15, 0.02], trail: [1.7, 0.6, 0.1], mote: [2.6, 1.0, 0.2], dust: [0.2, 0.15, 0.13] },
    void: { core: [2.1, 1.5, 2.7], glow: [0.85, 0.3, 1.6], deep: [0.3, 0.02, 0.5], trail: [0.65, 0.2, 1.2], mote: [1.3, 0.5, 2.1], dust: [0.16, 0.1, 0.22] },
    astral: { core: [2.5, 2.3, 2.9], glow: [1.25, 0.6, 1.9], deep: [0.35, 0.15, 0.95], trail: [0.85, 0.5, 1.5], mote: [1.9, 1.4, 2.6], dust: [0.4, 0.36, 0.5] },
    necro: { core: [1.7, 2.6, 1.9], glow: [0.35, 1.6, 0.85], deep: [0.35, 0.03, 0.5], trail: [0.3, 1.0, 0.55], mote: [0.6, 2.0, 1.1], dust: [0.16, 0.2, 0.18] },
    steel: { core: [2.2, 2.3, 2.5], glow: [1.2, 1.4, 1.8], deep: [0.3, 0.4, 0.6], trail: [0.6, 0.7, 0.9], mote: [1.4, 1.6, 2.0], dust: [0.5, 0.48, 0.45] },
    bone: { core: [2.0, 2.3, 1.8], glow: [0.9, 1.4, 0.8], deep: [0.3, 0.35, 0.2], trail: [0.6, 0.9, 0.5], mote: [1.2, 1.8, 1.0], dust: [0.4, 0.42, 0.36] },
    shadow: { core: [2.2, 1.3, 1.8], glow: [1.3, 0.22, 0.65], deep: [0.3, 0.02, 0.2], trail: [0.75, 0.1, 0.45], mote: [1.4, 0.4, 1.0], dust: [0.12, 0.08, 0.12] },
    rage: { core: [2.6, 1.6, 0.9], glow: [2.2, 0.45, 0.1], deep: [0.9, 0.08, 0.02], trail: [1.4, 0.3, 0.05], mote: [2.4, 0.6, 0.15], dust: [0.45, 0.3, 0.25], rock: [0.45, 0.22, 0.16], emit: [0.8, 0.2, 0.05] },
    ember: { core: [2.6, 2.0, 1.1], glow: [2.4, 0.9, 0.2], deep: [1.0, 0.15, 0.02], trail: [1.5, 0.6, 0.12], mote: [2.5, 1.0, 0.25], dust: [0.3, 0.24, 0.2] },
    iron: { core: [2.4, 2.2, 1.9], glow: [1.8, 1.0, 0.4], deep: [0.6, 0.25, 0.08], trail: [0.9, 0.8, 0.7], mote: [2.2, 1.2, 0.4], dust: [0.4, 0.38, 0.36], rock: [0.35, 0.35, 0.38], emit: [0.5, 0.25, 0.08] },
    soul: { core: [1.8, 2.4, 2.8], glow: [0.4, 1.3, 2.0], deep: [0.1, 0.35, 0.7], trail: [0.3, 0.8, 1.3], mote: [0.9, 1.9, 2.6], dust: [0.2, 0.26, 0.32] },
    blood: { core: [2.6, 1.2, 1.3], glow: [2.0, 0.12, 0.25], deep: [0.6, 0.0, 0.05], trail: [1.2, 0.08, 0.15], mote: [2.2, 0.3, 0.4], dust: [0.2, 0.08, 0.08], blood: [2.2, 0.2, 0.3] },
    fey: { core: [2.0, 2.6, 2.2], glow: [0.5, 1.8, 1.0], deep: [0.1, 0.6, 0.5], trail: [0.4, 1.2, 0.8], mote: [1.4, 2.4, 1.4], dust: [0.4, 0.5, 0.45], leaf: [1.2, 2.0, 1.4] },
    rune: { core: [1.8, 2.2, 2.7], glow: [0.45, 1.1, 2.2], deep: [0.1, 0.25, 0.8], trail: [0.4, 0.7, 1.4], mote: [0.8, 1.6, 2.6], dust: [0.5, 0.48, 0.44], rock: [0.42, 0.4, 0.38], emit: [0.25, 0.6, 1.3] },
  };
  const rnd = (a, b) => a + (b - a) * Math.random();
  const inBall = () => { const v = V3(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)); return v.lengthSq() > 1 ? inBall() : v; };
  const dirAround = () => { const a = rnd(0, 6.283); return V3(Math.cos(a), 0, Math.sin(a)); };

  function create(o) {
    const glow = pool(900, "add"), smoke = pool(160, "smoke"), dark = pool(160, "dark");
    const rocks = solids(140, new THREE.IcosahedronGeometry(1, 0)), spikes = solids(80, new THREE.ConeGeometry(1, 1, 6, 1).translate(0, 0.5, 0));
    for (const m of [glow.mesh, smoke.mesh, dark.mesh, rocks.mesh, spikes.mesh]) o.add(m);
    const decals = [], beams = [], ribs = [], shakes = [], later = [], missiles = [], meshes = [], punches = [], dims = [], state = new Map();
    let cam = null;                                                          // the camera, as last drawn (a halo faces it)
    /** a mesh effect: step(u, now) each frame (u its age 0 → 1); it is dropped at the end of its life */
    function meshFx(objs, t0, life, stepFn) {
      for (const m of objs) { m.frustumCulled = false; m.material.userData.toScreen = true; o.add(m); }
      const M = { objs, t0, life, stepFn, kill: () => objs.forEach((m) => { o.remove(m); m.material.dispose(); }) };
      meshes.push(M);
      return M;
    }
    function vortex(at, k, t0, grow, life, P, spin = 1) {
      const mk = (r0, r1, h, hot, mid, cool, kk, order, darkSheet = false) => {
        const m = new THREE.Mesh(TUBE, new THREE.ShaderMaterial({ vertexShader: VORTEX_VS, fragmentShader: VORTEX_FS, side: THREE.DoubleSide, depthTest: true, ...(darkSheet ? OVER : ADD),
          uniforms: { uTime: { value: 0 }, uAge: { value: 0 }, uK: { value: kk }, uDark: { value: darkSheet ? 1 : 0 }, uTwist: { value: (darkSheet ? 3.5 : 5.5) * spin }, uSpin: { value: (darkSheet ? 2.5 : 4.5) * spin }, uR0: { value: r0 * k }, uR1: { value: r1 * k }, uGrow: { value: 0 }, uHot: C(hot), uMid: C(mid), uCool: C(cool) } }));
        m.position.copy(at); m.scale.set(1, h * k, 1); m.renderOrder = order; return m;
      };
      // a hot core, a sheet of fire round it (orange into deep red, the white kept to the band crests), and outside it
      // a torn sheet of black smoke: the dark that makes the fire read
      const hot = P.glow.map((x, i) => Math.min(x * 0.75, [1.5, 1.05, 0.5][i]));
      const core = mk(0.05, 0.13, 1.15, hot, P.glow.map((x) => x * 0.6), P.deep, 0.75, 13);
      const sheet = mk(0.12, 0.32, 1.0, P.glow.map((x) => x * 0.6), P.deep.map((x) => x * 1.1), [0.18, 0.02, 0.0], 0.7, 13);
      const smokeSheet = mk(0.17, 0.46, 0.95, [0, 0, 0], [0, 0, 0], [0.05, 0.025, 0.02], 0.7, 12, true);
      return meshFx([smokeSheet, sheet, core], t0, life, (u, now) => {
        const g = Math.min(1, (now - t0) / grow), gg = 1 - Math.pow(1 - g, 3);
        for (const m of [core, sheet, smokeSheet]) { const U = m.material.uniforms; U.uTime.value = now / 1000; U.uGrow.value = gg; U.uAge.value = Math.max(0, (u - 0.3) / 0.7); }
      });
    }
    function hole(at, k, t0, life, P, stepFn) {
      const m = new THREE.Mesh(BALL, new THREE.ShaderMaterial({ vertexShader: HOLE_VS, fragmentShader: HOLE_FS, depthTest: false, ...OVER,
        uniforms: { uK: { value: 1 }, uTime: { value: 0 }, uGlow: C(P.glow), uDeep: C(P.deep.map((x) => x * 0.08)) } }));
      m.position.copy(at); m.scale.setScalar(0.001); m.renderOrder = 16;
      return meshFx([m], t0, life, (u, now) => { m.material.uniforms.uTime.value = now / 1000; stepFn(m, u, now); });
    }
    let last = null;
    const put = (pl, p) => { if (pl.P.length >= pl.N * 1.5) pl.P.shift(); const q = { v: V3(), rot: 0, spin: 0, env: "flash", k: 1, seed: Math.random(), ...p, p: p.p.clone() }; pl.P.push(q); return q; };
    const end = (q, now) => { if (q) q.life = Math.max(1, now - q.t0); };            // a sprite put out now
    const K = (u) => u.fig.root.scale.x;
    const NOW = () => last ?? performance.now();
    function decal(fs, at, r, life, uni = {}, over = false) {
      const m = new THREE.Mesh(DISC, new THREE.ShaderMaterial({ vertexShader: DECAL_VS, fragmentShader: fs, side: THREE.DoubleSide, depthTest: false, ...(over ? OVER : ADD),
        uniforms: { uK: { value: 1 }, uAge: { value: 0 }, uGrow: { value: 1 }, uU: { value: 0 }, uRot: { value: 0 }, uStyle: { value: 0 }, uRoot: { value: 0 }, uSeed: { value: Math.random() * 40 },
          uTint: { value: new THREE.Color(1.9, 1.35, 0.55) }, uHot: { value: new THREE.Color(2.6, 2.3, 1.7) }, uMid: { value: new THREE.Color(2.2, 1.35, 0.45) }, uCool: { value: new THREE.Color(0.9, 0.18, 0.02) }, ...uni } }));
      m.material.userData.toScreen = true; m.frustumCulled = false; m.renderOrder = over ? 4 : 5;
      m.position.set(at.x, (over ? 0.003 : 0.006) + Math.max(0, at.y || 0) * 0, at.z); m.scale.setScalar(r);
      o.add(m);
      const d = { m, t0: NOW(), life };
      decals.push(d);
      return d;
    }
    /** a streak on the ground from → to (flat), `width` across, over `life` ms; revealed at once to `x0` (0–1 along),
     *  its front then running on to the end over `sweep` ms (STREAK_FS) */
    function streak(from, to, width, life, x0, sweep, style, P) {
      const dx = to.x - from.x, dz = to.z - from.z, len = Math.hypot(dx, dz);
      const m = new THREE.Mesh(STRIP, new THREE.ShaderMaterial({ vertexShader: DECAL_VS, fragmentShader: STREAK_FS, side: THREE.DoubleSide, depthTest: true, ...OVER,   // (the figures stand in front of it)
        uniforms: { uRot: { value: 0 }, uAge: { value: 0 }, uFront: { value: x0 }, uK: { value: 1 }, uSeed: { value: Math.random() * 40 }, uStyle: { value: style }, uLen: { value: len },
          uHot: C(P.core), uMid: C(P.glow), uCool: C(P.deep) } }));
      m.material.userData.toScreen = true; m.frustumCulled = false; m.renderOrder = 4;
      m.position.set((from.x + to.x) / 2, 0.004, (from.z + to.z) / 2); m.rotation.set(0, -Math.atan2(dz, dx), 0); m.scale.set(Math.max(len, 1e-3), 1, width);
      o.add(m);
      const d = { m, t0: NOW(), life, env: "streak", x0, sweep };
      decals.push(d);
      return d;
    }
    // thorns bursting along a line, a wave running out from `at` both ways
    function spikeLine(from, to, at, k, P) {
      const len = from.distanceTo(to), n = Math.max(3, Math.round(len / (0.3 * k))), t0 = NOW(), side = V3(-(to.z - from.z), 0, to.x - from.x).normalize();
      for (let i = 0; i <= n; i++) {
        const p = from.clone().lerp(to, i / n).addScaledVector(side, rnd(-0.12, 0.12) * k), far = p.distanceTo(at);
        spikes.P.push({ p, dir: V3(rnd(-0.25, 0.25), 1, rnd(-0.25, 0.25)).normalize(), twist: rnd(0, 6.28), h: rnd(0.16, 0.3) * k, w: rnd(0.03, 0.045) * k,
          col: [0.22, 0.2, 0.1].map((c) => c * rnd(0.85, 1.1)), emit: [0.15, 0.55, 0.06], t0: t0 + (far / k) * 90, grow: 110, life: 1300 });
      }
    }
    const C = (c) => ({ value: new THREE.Color(...c) });
    function beam(at, h, w, life, tint, k = 1, env = "pop") {
      const m = new THREE.Mesh(COLUMN, new THREE.ShaderMaterial({ vertexShader: DECAL_VS, fragmentShader: BEAM_FS, side: THREE.DoubleSide, depthTest: false, ...ADD,
        uniforms: { uK: { value: 0 }, uTime: { value: 0 }, uSeed: { value: Math.random() * 20 }, uTint: C(tint) } }));
      m.material.userData.toScreen = true; m.frustumCulled = false; m.renderOrder = 14;
      m.position.copy(at); m.scale.set(w, h, 1);
      o.add(m);
      const b = { m, t0: NOW(), life, k, env };
      beams.push(b);
      return b;
    }
    const kill = (m) => { o.remove(m); m.material.dispose(); };
    const stOf = (u) => { let s = state.get(u); if (!s) { s = { aura: 0, atk: null, vic: 0, flash: 0, halo: null }; state.set(u, s); } return s; };
    const blade = (f) => { const [a, b] = f.blade; a.updateWorldMatrix(true, false); b.updateWorldMatrix(true, false); return [a.getWorldPosition(V3()), b.getWorldPosition(V3())]; };
    const bone = (f, n) => { const b = f.bones?.[n]; if (!b) return null; b.updateWorldMatrix(true, false); return b; };
    const chestOf = (u) => bone(u.fig, "Spine2") || u.fig.root;
    const recipe = (u) => u.fig.sig?.fx || {};
    const palOf = (fx) => PAL[fx.pal] || PAL.holy;
    // the burst of little things a blow throws (feathers drift, leaves flutter, snow and shards glitter, embers rise)
    function bits(kind, at, n, k, P, dir = null, t0 = NOW()) {
      for (let i = 0; i < n; i++) {
        const out = dirAround().multiplyScalar(rnd(0.3, 0.9) * k);
        if (dir) out.addScaledVector(dir, 0.4 * k);
        if (kind === "feather" || kind === "leaf") put(glow, { p: at, v: out.setY(rnd(0.9, 1.6) * k), grav: 0.9 * k, drag: 2.6, sway: 0.25 * k, t0: t0 + rnd(0, 60), life: rnd(1600, 2400), s0: 0.1 * k, s1: 0.085 * k, rot: rnd(0, 6.28), spin: rnd(-2.4, 2.4), col: kind === "leaf" ? P.leaf || P.glow : [1.9, 1.45, 0.7], k: kind === "leaf" ? 0.9 : 1.05, shape: SHAPE[kind], env: "late" });
        else if (kind === "snow") put(glow, { p: at.clone().add(inBall().multiplyScalar(0.25 * k)), v: out.multiplyScalar(0.6).setY(rnd(0.3, 0.9) * k), grav: 0.4 * k, drag: 2.2, sway: 0.15 * k, t0: t0 + rnd(0, 120), life: rnd(1400, 2200), s0: 0.05 * k, s1: 0.04 * k, rot: rnd(0, 6.28), spin: rnd(-1.5, 1.5), col: P.mote, k: 1.1, shape: SHAPE.snow, env: "late" });
        else if (kind === "shard") put(glow, { p: at, v: out.multiplyScalar(2.2).setY(rnd(0.8, 2.0) * k), grav: 5 * k, drag: 1.2, t0, life: rnd(500, 900), s0: 0.06 * k, s1: 0.05 * k, rot: rnd(0, 6.28), spin: rnd(-9, 9), col: P.core, k: 1.1, shape: SHAPE.shard, env: "fade", floor: 0.01 });
        else if (kind === "star") put(glow, { p: at, v: out.multiplyScalar(1.4).setY(rnd(0.6, 1.4) * k), grav: 1.2 * k, drag: 2.2, t0: t0 + rnd(0, 80), life: rnd(700, 1200), s0: 0.07 * k, s1: 0.03 * k, rot: rnd(0, 6.28), spin: rnd(-4, 4), col: P.mote, k: 1.3, shape: SHAPE.star5, env: "pop" });
        else if (kind === "wisp") put(glow, { p: at.clone().add(inBall().multiplyScalar(0.15 * k)), v: out.multiplyScalar(0.8).setY(rnd(0.6, 1.3) * k), drag: 1.4, t0: t0 + rnd(0, 120), life: rnd(700, 1100), s0: 0.07 * k, s1: 0.05 * k, col: P.mote, k: 1.2, shape: SHAPE.wisp, env: "mote", stretch: 0.22 });
        else put(glow, { p: at.clone().add(inBall().multiplyScalar(0.3 * k)), v: V3(rnd(-0.1, 0.1) * k, rnd(0.25, 0.8) * k, rnd(-0.1, 0.1) * k), drag: 0.6, sway: 0.08 * k, t0: t0 + rnd(0, 250), life: rnd(900, 1700), s0: 0.03 * k, s1: 0.018 * k, col: P.mote, k: 1.3, shape: SHAPE.sparkle, env: "mote" });
      }
    }
    function rockBurst(at, n, k, P, speed = 1) {
      for (let i = 0; i < n; i++) {
        const d = dirAround();
        rocks.P.push({ p: at.clone().addScaledVector(d, rnd(0.05, 0.25) * k).setY(0.05 * k), v: d.multiplyScalar(rnd(0.4, 1.3) * k * speed).setY(rnd(1.2, 2.6) * k * speed), grav: 7 * k, axis: inBall().normalize(), rot: rnd(0, 6), spin: rnd(-8, 8),
          size: rnd(0.03, 0.07) * k, col: (P.rock || [0.4, 0.35, 0.3]).map((c) => c * rnd(0.8, 1.15)), emit: [0, 0, 0], t0: NOW(), life: rnd(1300, 1900) });
      }
    }
    // spikes burst from the ground round a point (ice: pale blue, glowing rims; stone; thorn: dark, green-rimmed)
    function spikeRing(kind, g, k, heavy, P, dir) {
      const col = kind === "ice" ? [0.55, 0.78, 1.0] : kind === "thorn" ? [0.22, 0.2, 0.1] : [0.4, 0.34, 0.28], emit = kind === "ice" ? [0.3, 0.75, 1.5] : kind === "thorn" ? [0.15, 0.55, 0.06] : P.emit ? P.emit.map((c) => c * 0.4) : [0.1, 0.06, 0.03];
      const n = heavy ? 11 : 7, t0 = NOW();
      const add = (p, d, h, w, delay) => spikes.P.push({ p, dir: d.normalize(), twist: rnd(0, 6.28), h, w, col: col.map((c) => c * rnd(0.85, 1.1)), emit, t0: t0 + delay, grow: 110, life: heavy ? 1500 : 1200 });
      add(g.clone(), V3(rnd(-0.1, 0.1), 1, rnd(-0.1, 0.1)), (heavy ? 0.62 : 0.48) * k, 0.07 * k, 0);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283 + rnd(-0.3, 0.3), R = rnd(0.16, heavy ? 0.5 : 0.38) * k, d = V3(Math.cos(a), 0, Math.sin(a));
        add(g.clone().addScaledVector(d, R), d.clone().multiplyScalar(rnd(0.35, 0.7)).setY(1), rnd(0.22, 0.42) * k * (1 - R / k * 0.6), rnd(0.035, 0.055) * k, (R / k) * 180);
      }
      if (dir) for (let i = 1; i <= 3; i++) add(g.clone().addScaledVector(dir, -i * 0.16 * k), V3(rnd(-0.2, 0.2), 1, rnd(-0.2, 0.2)).addScaledVector(dir, 0.3), (0.2 + 0.05 * i) * k, 0.045 * k, -i * 30);   // a line of them running in from the attacker's side
    }
    /** something flying from → to over [t0, t1] (bowed up by `arc` at its middle): its head sprites drawn along the
     *  flight, motes shed behind it; land() when it arrives */
    function missile(from, to, t0, t1, m) {
      const obj = new THREE.Object3D(); obj.position.copy(from);
      const M = { from: from.clone(), to: to.clone(), t0, t1, obj, prev: from.clone(), arc: m.arc || 0, land: m.land, trail: m.trail, shed: 0, heads: [] };
      for (const h of m.heads) { put(glow, { p: from, track: obj, t0, life: t1 - t0 + 20, env: "hold", ...h }); M.heads.push(glow.P[glow.P.length - 1]); }
      missiles.push(M);
      return M;
    }
    /** the sun god's wheel of blades: they form one by one on a ring behind him (facing the viewer, turning slowly,
     *  points outward), turn one by one to his foe as he levels the sword, and are loosed in quick succession — each a
     *  straight line of light that marks its hit with a small crossed cut; the last lands on the blow */
    function castArray(u, A, q, now, T, P, k, fx) {
      const f = u.fig, N = (fx.blades || 12) + (A.tier >= 3 ? 6 : 0);
      if (!cam) return;
      const R = 0.34 * k, ch = bone(f, "Spine2")?.getWorldPosition(V3()) || f.root.position.clone().add(V3(0, 0.6 * k, 0));
      const ctr = ch.add(V3(0, 0.08 * k, 0)).addScaledVector(V3(0, 0, -1).applyQuaternion(f.root.quaternion), 0.12 * k);
      const right = V3(1, 0, 0).applyQuaternion(cam.quaternion), up = V3(0, 1, 0).applyQuaternion(cam.quaternion);
      if (!A.arr) {
        A.arr = { blades: [], wheel: null, sun: null };
        A.arr.wheel = put(glow, { p: ctr, t0: now, life: A.align + 200, s0: R * 1.6, s1: R * 2.25, col: P.glow.map((x) => x * 0.6), k: 0.5, shape: SHAPE.ring, env: "hold" });
        A.arr.sun = put(glow, { p: ctr, t0: now, life: A.align + 200, s0: R * 0.6, s1: R * 1.1, rot: 0, spin: 0.5, col: P.glow.map((x) => x * 0.35), k: 0.35, shape: SHAPE.star, env: "hold" });
      }
      const Ar = A.arr, spin = now * 0.0007;
      Ar.wheel.p.copy(ctr); Ar.sun.p.copy(ctr);
      for (let i = 0; i < N; i++) {
        const born = 0.04 + 0.34 * (i / N), land = A.t0 + A.align * (0.74 + 0.26 * i / (N - 1)), fire = land - 95;
        let B = Ar.blades[i];
        if (!B && q >= born) {
          B = Ar.blades[i] = { spr: put(glow, { p: ctr, t0: now, life: 1e6, s0: 0.001, s1: 0.001, col: P.glow, k: 1.15, shape: SHAPE.blade, env: "on", stretch: 1e-4 }), born: now, flown: false };
          put(glow, { p: ctr, t0: now, life: 160, s0: 0.12 * k, s1: 0.2 * k, col: P.core.map((x) => x * 0.6), k: 1.0, shape: SHAPE.sparkle });
        }
        if (!B || B.flown) continue;
        const a = spin + (i / N) * 6.2832, out = right.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
        const appear = Math.min(1, (now - B.born) / 140), pos = ctr.clone().addScaledVector(out, R * (0.8 + 0.2 * appear));
        const aimW = Math.min(1, Math.max(0, (q - (0.5 + 0.18 * i / N)) / 0.1)), to = T.center.clone().sub(pos).normalize();
        B.spr.p.copy(pos); B.spr.v.copy(out.lerp(to, aimW).normalize()); B.spr.s0 = B.spr.s1 = 0.24 * k * appear;
        if (now >= fire) {
          B.flown = true; end(B.spr, now);
          const hitAt = T.center.clone().add(V3(rnd(-0.1, 0.1), rnd(-0.12, 0.14), rnd(-0.1, 0.1)).multiplyScalar(k));
          missile(pos, hitAt, now, land, { heads: [{ s0: 0.24 * k, s1: 0.24 * k, col: P.glow, k: 1.2, shape: SHAPE.blade, stretch: 1e-4 }, { s0: 0.03 * k, s1: 0.03 * k, col: P.glow.map((x) => x * 0.8), k: 1.0, shape: SHAPE.spark, stretch: 0.026 }], land: (p) => {
            const t = NOW(), r0 = rnd(0, 3.14);
            for (const d of [0.75, -0.75]) put(glow, { p, t0: t, life: 140, s0: 0.1 * k, s1: 0.26 * k, rot: r0 + d, col: P.glow, k: 1.0, shape: SHAPE.cut, env: "pop" });
            for (let j = 0; j < 3; j++) put(glow, { p, v: inBall().normalize().multiplyScalar(rnd(0.9, 1.7) * k), grav: 5 * k, drag: 2, t0: t, life: rnd(160, 280), s0: 0.014 * k, s1: 0.008 * k, col: P.glow, k: 1.4, shape: SHAPE.spark, env: "fade", stretch: 0.05 });
          } });
        }
      }
      if (q >= 1 && !Ar.done) { Ar.done = true; end(Ar.wheel, now); end(Ar.sun, now); put(glow, { p: ctr, t0: now, life: 180, s0: R * 2.2, s1: R * 3.2, col: P.glow, k: 0.8, shape: SHAPE.ring, env: "fade" }); }
    }
    /** the star-flame god's pillar: the ground under his foe is marked as he charges (a crisp ring, its fill sweeping out,
     *  the cracks warming, embers drawn down into it); on the release a vortex of fire tears up out of it, tossing the
     *  foe, a skirt of black smoke rolling out at its foot; it burns out from the top */
    function castPillar(u, A, q, now, T, P, k, fx) {
      const g = T.ground.clone().setY(0), Rz = 0.62 * k;
      if (!A.zone && q >= 0.04) {
        A.zone = decal(ZONE_FS, g, Rz, A.contact - (now - A.t0) + 380, { uTint: C(P.glow.map((x) => x * 0.8)), uFill: { value: 0 } }); A.zone.env = "zone";
        A.cr = decal(CRACK_FS, g, Rz * 0.95, A.contact - (now - A.t0) + 200, { uHot: C(P.glow), uMid: C(P.glow.map((x) => x * 0.7)), uCool: C(P.deep) }); A.cr.env = "pre";
      }
      if (A.zone) {
        const fq = Math.min(1, q / 0.95); A.zone.fill = 1 - Math.pow(1 - fq, 2); A.zone.rot = now * 0.0011;
        A.zone.k = now < A.t0 + A.align ? 1 : Math.max(0, 1 - (now - A.t0 - A.align) / 220);
        A.cr.grow = 0.2 + 0.8 * fq; A.cr.age = 0.55 - 0.4 * fq;
        if (q < 1) for (A.draw = (A.draw || 0) + 55 * Math.min(0.05, (now - (A.lastP ?? now)) / 1000); A.draw >= 1; A.draw--) {
          const a = rnd(0, 6.28), from = g.clone().add(V3(Math.cos(a) * Rz * 1.1, rnd(0.1, 0.5) * k, Math.sin(a) * Rz * 1.1));
          put(glow, { p: from, pull: g.clone().add(V3(0, 0.02 * k, 0)), pullK: 5, t0: now, life: 420, s0: 0.03 * k, s1: 0.014 * k, col: P.mote, k: 1.3, shape: SHAPE.sparkle, env: "mote" });
        }
        A.lastP = now;
      }
      if (!A.pillar && q >= 1) {
        const grow = Math.max(90, A.contact - A.align);
        A.pillar = vortex(g, k * (A.tier >= 3 ? 1.25 : 1), now, grow, A.tier >= 3 ? 1500 : 1250, P, 1);
        for (let i = 0; i < 14; i++) {                   // the black smoke skirt rolling out at its foot
          const d = dirAround();
          put(dark, { p: g.clone().addScaledVector(d, 0.15 * k).setY(0.06 * k), v: d.multiplyScalar(rnd(0.7, 1.2) * k).setY(rnd(0.05, 0.25) * k), drag: 2.6, t0: now + grow * 0.6, life: rnd(700, 1000), s0: 0.14 * k, s1: 0.34 * k, col: [0.05, 0.03, 0.025], k: 0.8, shape: SHAPE.glow, env: "pop" });
        }
        for (let i = 0; i < 26; i++) {                   // embers whirled up in it
          const a = rnd(0, 6.28), r = rnd(0.1, 0.3) * k;
          put(glow, { p: g.clone().add(V3(Math.cos(a) * r, rnd(0, 0.3) * k, Math.sin(a) * r)), v: V3(-Math.sin(a) * 1.1 * k, rnd(1.4, 2.6) * k, Math.cos(a) * 1.1 * k), drag: 1.1, t0: now + rnd(0, 400), life: rnd(600, 1000), s0: 0.02 * k, s1: 0.01 * k, col: Math.random() < 0.3 ? P.core : P.mote, k: 1.4, shape: SHAPE.spark, env: "fade", stretch: 0.04 });
        }
      }
    }
    /** the dark-moon goddess's collapse: three crescents wheel round her as she draws the dark in; before her foe the
     *  air tears open — a rift, black inside, its lips burning — and a black hole swells in it, its limb burning,
     *  pulling the light in in streaks while rings close in on the ground; on her release it collapses to a point */
    function castCollapse(u, A, q, now, T, P, k, fx) {
      const f = u.fig, c = T.center.clone();
      if (!A.moons && q > 0.02 && q < 1) {
        A.moons = [0, 1, 2].map((i) => put(glow, { p: f.root.position, t0: now, life: A.align, s0: 0.1 * k, s1: 0.14 * k, rot: 0, col: P.glow, k: 1.0, shape: SHAPE.arc, env: "hold" }));
      }
      if (A.moons && q < 1) {
        const hc = (bone(f, "Head")?.getWorldPosition(V3()) || f.root.position.clone().add(V3(0, 0.9 * k, 0))).add(V3(0, 0.05 * k, 0));
        A.moons.forEach((m, i) => { const a = now * 0.004 + i * 2.094; m.p.copy(hc).add(V3(Math.cos(a) * 0.26 * k, 0.06 * k * Math.sin(a * 2), Math.sin(a) * 0.26 * k)); m.rot = -a; });
      }
      // the rift: it opens (0.1 → 0.4), the hole swells in it (0.35 → 1) and it closes over it
      if (!A.rift && q >= 0.1) {
        const life = A.contact - (now - A.t0);
        A.rift = [put(dark, { p: c, t0: now, life, s0: 0.001, s1: 0.001, col: [0.02, 0.0, 0.04], k: 1, shape: SHAPE.rift, env: "hold" }), put(glow, { p: c, t0: now, life, s0: 0.001, s1: 0.001, col: P.glow, k: 1.1, shape: SHAPE.rift, env: "hold" })];
      }
      if (A.rift) { const o2 = Math.min(1, (q - 0.1) / 0.3), cl = q > 0.55 ? Math.min(1, (q - 0.55) / 0.4) : 0; for (const r of A.rift) { r.s0 = r.s1 = 0.62 * k * (1 - Math.pow(1 - o2, 3)) * (1 - 0.35 * cl); r.k = r === A.rift[1] ? 1.1 * (1 - cl) : 1 - 0.6 * cl; } }
      if (!A.hole && q >= 0.35) {
        const t1 = A.t0 + A.align, t2 = A.t0 + A.contact;
        A.lens = [put(dark, { p: c, t0: now, life: t2 - now, s0: 0.001, s1: 0.001, col: [0.03, 0.0, 0.05], k: 0.85, shape: SHAPE.ring, env: "hold" }), put(glow, { p: c, t0: now, life: t2 - now, s0: 0.001, s1: 0.001, col: P.glow, k: 1.0, shape: SHAPE.ring, env: "hold" })];
        A.hole = hole(c, k, now, t2 - now + 10, P, (m, u2, t) => {
          const grow = Math.min(1, (t - (A.t0 + A.align * 0.35)) / (A.align * 0.55)), fall = t > t1 ? Math.min(1, (t - t1) / Math.max(60, t2 - t1)) : 0;
          const r = (A.tier >= 3 ? 0.26 : 0.2) * k * (1 - Math.pow(1 - grow, 2)) * (1 - fall * fall);
          m.scale.setScalar(Math.max(0.001, r));
          A.lens[0].s0 = A.lens[0].s1 = r * 2.6; A.lens[1].s0 = A.lens[1].s1 = r * 3.1;
        });
      }
      if (A.hole && q < 1) {
        for (A.pull = (A.pull || 0) + 90 * Math.min(0.05, (now - (A.lastC ?? now)) / 1000); A.pull >= 1; A.pull--) {
          const d = inBall().normalize(), from = c.clone().addScaledVector(d, rnd(0.45, 0.75) * k), tang = d.clone().cross(V3(0, 1, 0)).normalize().multiplyScalar(1.4 * k);
          put(glow, { p: from, v: tang, pull: c.clone(), pullK: 4.5, t0: now, life: 380, s0: 0.035 * k, s1: 0.01 * k, col: Math.random() < 0.3 ? P.core : P.mote, k: 1.3, shape: SHAPE.spark, env: "mote", stretch: 0.05 });
        }
        if (now - (A.ringAt ?? 0) > 260) { A.ringAt = now; const d = decal(SHOCK_FS, T.ground, 0.9 * k, 380, { uTint: C(P.glow.map((x) => x * 0.7)) }); d.env = "rev"; }
      }
      A.lastC = now;
    }
    // soul wisps drawn out of the victim and home into the attacker (life drained)
    function drain(from, to, n, k, col) {
      for (let i = 0; i < n; i++) put(glow, { p: from.clone().add(inBall().multiplyScalar(0.18 * k)), v: inBall().multiplyScalar(1.2 * k).setY(rnd(0.6, 1.4) * k), seek: to, seekK: 22, drag: 3.5, t0: NOW() + 80 + i * 35, life: 620, s0: 0.08 * k, s1: 0.05 * k, col, k: 1.2, shape: SHAPE.wisp, env: "mote", stretch: 0.18 });
    }

    // ---------------------------------------------------------------- beats
    // attack: a sigil flares under the attacker as it coils (a god's column of light rises round it); light streams into
    // the weapon (or the casting hand); a glint rides the point at the top of the swing; the swoosh follows the weapon
    // from the swing to just past the blow. A caster that calls its blow down from the sky or up from the ground marks
    // the foe's ground as it charges. The blow itself (impact) is the director's contact
    function attack(u, plan) {
      const s = stOf(u), k = K(u), fx = recipe(u), P = palOf(fx), now = performance.now();
      if (s.atk?.rib) s.atk.rib.open = false;
      s.atk = { t0: plan.t0, align: plan.align, contact: plan.contact ?? plan.align + 150, tier: plan.tier || 1, glint: false, rib: null, hit: false, charge: 0, rise: 0, leap: plan.leap ?? 0.3, target: plan.target, calls: 0, sky: null };
      if (fx.sigil !== false && !u.fig.spell) {
        const d = decal(SIGIL_FS, u.fig.root.position, 0.62 * k * (fx.scale || 1), plan.align * 0.55 + 260, { uTint: C(P.glow.map((c) => c * 0.85)), uStyle: { value: SIGILS[fx.sigil] ?? 0 } });
        d.env = "pop"; d.spin = 1.6;
        for (let i = 0; i < 10; i++) {
          const a = rnd(0, 6.28), R = rnd(0.25, 0.55) * k;
          put(glow, { p: u.fig.root.position.clone().add(V3(Math.cos(a) * R, 0.02 * k, Math.sin(a) * R)), v: V3(0, rnd(0.5, 1.1) * k, 0), drag: 1.5, t0: now + rnd(0, 150), life: rnd(450, 700), s0: 0.035 * k, s1: 0.02 * k, col: P.mote, k: 1.4, shape: SHAPE.sparkle, env: "mote" });
        }
      }
      const T = plan.target?.();
      // a god's blow: the stage dims round it from the charge to just past the blow
      if (fx.dim) dims.push({ t0: plan.t0, peak: plan.t0 + plan.align * 0.35, hold: plan.t0 + (plan.contact ?? plan.align), a: fx.dim });
      // one who strikes from the shadows: smoke where she stood as she goes, smoke where she comes out
      if (fx.vanish) {
        const puff = (at, t) => { for (let i = 0; i < 9; i++) { const d = dirAround(); put(smoke, { p: at.clone().addScaledVector(d, 0.08 * k).setY(rnd(0.05, 0.5) * k), v: d.multiplyScalar(rnd(0.3, 0.7) * k).setY(rnd(0.1, 0.4) * k), drag: 2.2, t0: t + rnd(0, 60), life: rnd(500, 800), s0: 0.14 * k, s1: 0.3 * k, col: P.dust, k: 0.75, shape: rnd(0, 9), env: "pop" }); } };
        const home = u.fig.root.position.clone();
        later.push({ at: plan.t0 + plan.align * (plan.leap ?? 0.5), fn: () => puff(home, NOW()) });
        if (T) later.push({ at: plan.t0 + plan.align * 0.92, fn: () => puff(T.ground.clone().lerp(home, 0.35), NOW()) });
      }
      // a call from the sky or the ground: its sigil opens on the foe's ground as the caster charges
      if (T && (fx.cast === "sky" || fx.cast === "ground")) {
        const d = decal(SIGIL_FS, T.ground, 0.7 * k, plan.align + 420, { uTint: C(P.glow), uStyle: { value: SIGILS[fx.callSigil || fx.sigil] ?? 2 } }); d.env = "grow"; d.spin = -1.2; d.gain = 0.7;
        if (fx.cast === "ground") { const v = decal(VOID_FS, T.ground, 0.6 * k, plan.align + 700, {}, true); v.env = "grow"; v.spin = 1; }
      }
      // the sun that gathers over the foe (a god's judgment), brightening until the blow falls from it
      if (T && fx.sky === "sun") {
        const p = T.ground.clone().add(V3(0, 1.35 * k, 0));
        s.atk.sky = { p, g: [], t0: now };
        put(glow, { p, t0: now, life: plan.align + 120, s0: 0.25 * k, s1: 0.75 * k, col: P.glow, k: 1.1, shape: SHAPE.glow, env: "grow" });
        put(glow, { p, t0: now, life: plan.align + 120, s0: 0.4 * k, s1: 1.3 * k, rot: 0, spin: 0.9, col: P.core.map((c) => c * 0.6), k: 0.9, shape: SHAPE.star, env: "grow" });
        put(glow, { p, t0: now, life: plan.align + 120, s0: 0.5 * k, s1: 1.0 * k, col: P.glow.map((c) => c * 0.7), k: 0.9, shape: SHAPE.ring, env: "grow" });
      }
    }
    function impact(u, hit, tier) {
      const s = stOf(u), k = K(u) * (recipe(u).scale || 1), now = performance.now(), heavy = tier >= 3, fx = recipe(u), P = palOf(fx);
      if (s.atk) { if (s.atk.hit) return; s.atk.hit = true; if (s.atk.rib) { s.atk.rib.stop = now + 50; s.atk.rib.fast = now; } }
      s.flash = now;
      const c = hit.at, g = hit.ground.clone().setY(0), dir = hit.dir.clone().setY(0).normalize();
      if (fx.modern) { modernHit(u, c, g, dir, P, k, heavy, fx); return; }
      const main = () => {
        const t = NOW();
        // the flash: a glow, a starburst, a lens streak
        put(glow, { p: c, t0: t, life: 70, s0: 0.45 * k, s1: 0.6 * k, col: P.core.map((x) => x * 0.65), k: 0.9, shape: SHAPE.glow });
        put(glow, { p: c, t0: t, life: heavy ? 150 : 110, s0: (heavy ? 1.0 : 0.75) * k, s1: (heavy ? 1.25 : 0.9) * k, rot: rnd(0, 1), spin: 0.8, col: P.glow, k: 0.9, shape: SHAPE.star });
        put(glow, { p: c, t0: t, life: 100, s0: 1.6 * k, s1: 2.0 * k, col: P.glow.map((x) => x * 0.6), k: 0.6, shape: SHAPE.flare });
        // the mark the weapon leaves across the victim: a line along the blow, a cross, a crescent, a piercing streak
        const mark = (rot, s0, s1, life = 220) => put(glow, { p: c.clone().add(V3(0, 0.06 * k, 0)), t0: t, life, s0: s0 * k, s1: s1 * k, rot, col: P.core.map((x) => x * 0.75), k: 1.2, shape: SHAPE.flare, env: "pop" });
        if (fx.slash === "cross") { mark(0.75, 0.4, 1.15); mark(-0.75, 0.4, 1.15, 260); }
        else if (fx.slash === "crescent") put(glow, { p: c.clone().add(V3(0, 0.05 * k, 0)), t0: t, life: 320, s0: 0.5 * k, s1: 1.1 * k, rot: rnd(-0.4, 0.4) + 3.6, col: P.glow, k: 1.2, shape: SHAPE.crescent, env: "pop" });
        else if (fx.slash === "pierce") {
          for (let i = 0; i < 2; i++) put(glow, { p: c.clone().addScaledVector(dir, 0.15 * k), v: dir.clone().multiplyScalar((3.2 + i) * k), drag: 5, t0: t + i * 30, life: 240, s0: 0.1 * k, s1: 0.05 * k, col: P.core.map((x) => x * 0.8), k: 1.3, shape: SHAPE.wisp, env: "pop", stretch: 0.12 });
          put(glow, { p: c.clone().addScaledVector(dir, 0.12 * k), t0: t, life: 260, s0: 0.2 * k, s1: 0.8 * k, col: P.glow, k: 1.0, shape: SHAPE.ring, env: "pop" });
        } else if (fx.slash !== false) mark(Math.PI / 2 - 0.42, 0.45, 1.1);
        // on the ground: a shock front, a slower, wider one, what the blow leaves there
        decal(SHOCK_FS, g, (heavy ? 1.35 : 1.0) * k, heavy ? 420 : 360, { uTint: C(P.glow) }).env = "u";
        decal(SHOCK_FS, g, (heavy ? 2.0 : 1.5) * k, 700, { uTint: C(P.deep.map((x) => x + 0.25)) }).env = "u";
        const R = (heavy ? 0.95 : 0.7) * k;
        if (fx.ground === "crack" || fx.ground === "roots") decal(CRACK_FS, g, R, heavy ? 1900 : 1500, { uHot: C(P.core), uMid: C(P.glow), uCool: C(P.deep), uRoot: { value: fx.ground === "roots" ? 1 : 0 } }).env = "crack";
        else if (fx.ground === "frost") decal(FROST_FS, g, R * 1.15, heavy ? 2200 : 1800, { uHot: C(P.core), uMid: C(P.glow) }).env = "crack";
        else if (fx.ground === "void") { const v = decal(VOID_FS, g, R * 1.3, 1600, {}, true); v.env = "late"; v.spin = 1.4; const d = decal(SIGIL_FS, g, R * 0.9, 1300, { uTint: C(P.glow), uStyle: { value: SIGILS[fx.sigil] ?? 1 } }); d.env = "late"; d.gain = 0.4; }
        else if (fx.ground === "rune") { const d = decal(SIGIL_FS, g, R * 1.1, 1300, { uTint: C(P.glow), uStyle: { value: SIGILS[fx.sigil] ?? 2 } }); d.env = "late"; d.gain = 0.5; }
        if (fx.ground && fx.ground !== "frost" && fx.ground !== "void") decal(SCORCH_FS, g, R * 0.85, 1900, { uTint: { value: new THREE.Color(0.03, 0.02, 0.015) } }, true).env = "late";
        if (fx.ground === "frost") decal(SCORCH_FS, g, R, 2000, { uTint: { value: new THREE.Color(0.55, 0.7, 0.85) } }, true).env = "late";   // a pale rime under it
        if (fx.beam !== false) beam(g, (heavy ? 2.2 : 1.5) * k, (heavy ? 0.42 : 0.26) * k, heavy ? 420 : 300, P.glow, 0.8, "flash");
        if (fx.spikes) spikeRing(fx.spikes, g, k, heavy, P, dir);
        if (fx.rocks) rockBurst(g, (heavy ? 1.5 : 1) * fx.rocks, k, P);
        if (fx.flame && o.fire) o.fire.burst(c, 0.07 * k);
        // sparks thrown up and away, falling
        for (let i = 0, n = heavy ? 34 : 24; i < n; i++) {
          const v = inBall().setY(0).normalize().multiplyScalar(0.6).add(dir.clone().multiplyScalar(rnd(0.3, 0.9))).setY(rnd(0.6, 1.6)).normalize().multiplyScalar(rnd(1.6, 3.4) * k);
          put(glow, { p: g.clone().add(V3(0, 0.08 * k, 0)), v, grav: 6 * k, drag: 1.6, t0: t, life: rnd(280, 560), s0: 0.02 * k, s1: 0.012 * k, col: Math.random() < 0.4 ? P.core : P.glow, k: 1.5, shape: SHAPE.spark, env: "fade", stretch: 0.055, floor: 0.01 });
        }
        bits("mote", g, heavy ? 22 : 14, k, P, null, t);
        if (fx.bits) bits(fx.bits, fx.bits === "wisp" || fx.bits === "star" ? c : c, (heavy ? 1.5 : 1) * (fx.nbits || 7) | 0, k, P, dir, t);
        if (fx.bits2) bits(fx.bits2, c, (heavy ? 1.5 : 1) * 8 | 0, k, P, dir, t);
        // dust (or mist, or smoke) thrown out along the ground
        for (let i = 0, n = (heavy ? 14 : 10) * (fx.dust ?? 1); i < n; i++) {
          const d = dirAround();
          put(smoke, { p: g.clone().addScaledVector(d, 0.12 * k).setY(0.05 * k), v: d.multiplyScalar(rnd(0.5, 1.0) * k).setY(rnd(0.05, 0.2) * k), drag: 2.4, t0: t, life: rnd(700, 1100), s0: 0.16 * k, s1: 0.36 * k, col: P.dust, k: 0.5, shape: rnd(0, 9), env: "pop" });
        }
        if (fx.drain) drain(c, chestOf(u), heavy ? 9 : 6, k, P.blood || P.mote);
        if (fx.cast === "ground") for (let i = 0, n = heavy ? 34 : 24; i < n; i++) {
          const a = rnd(0, 6.28), Rr = rnd(0.03, 0.32) * k;
          put(glow, { p: g.clone().add(V3(Math.cos(a) * Rr, 0.02 * k, Math.sin(a) * Rr)), v: V3(Math.cos(a) * 0.2 * k, rnd(1.6, 3.2) * k, Math.sin(a) * 0.2 * k), drag: 1.6, t0: t + rnd(0, 180), life: rnd(500, 800), s0: rnd(0.08, 0.13) * k, s1: 0.05 * k, col: Math.random() < 0.3 ? P.core : P.mote, k: 1.2, shape: SHAPE.wisp, env: "mote", stretch: 0.16 });
        }
        shakes.push({ t0: t, a: (heavy ? 0.05 : 0.032) * k * (fx.shake || 1), life: (heavy ? 320 : 240) * (fx.shake || 1) });
      };
      // a void blow first draws everything in, then bursts
      if (fx.implode) {
        for (let i = 0; i < 26; i++) { const from = c.clone().add(inBall().normalize().multiplyScalar(rnd(0.35, 0.6) * k)); put(glow, { p: from, pull: c.clone(), pullK: 14, t0: now, life: 150, s0: 0.04 * k, s1: 0.015 * k, col: P.mote, k: 1.5, shape: SHAPE.sparkle, env: "mote" }); }
        put(glow, { p: c, t0: now, life: 140, s0: 0.9 * k, s1: 0.2 * k, col: P.deep.map((x) => x + 0.3), k: 1.0, shape: SHAPE.ring, env: "fade" });
        later.push({ at: now + 110, fn: main });
      } else main();
    }
    /** a god's blow, the modern way: no blinding ball of light — a frame of speed lines closing on the target, one crisp
     *  flash, a dark ring under a thin bright one, then the god's own finish; the camera punches in and the stage is
     *  dimmed round the blow a moment */
    function modernHit(u, c, g, dir, P, k, heavy, fx) {
      const t = NOW(), s = stOf(u);
      put(glow, { p: c, t0: t, life: 150, s0: 1.5 * k, s1: 1.9 * k, col: P.glow.map((x) => x * 0.6), k: 0.9, shape: SHAPE.lines, rot: rnd(0, 6) });
      put(dark, { p: c, t0: t, life: 130, s0: 2.1 * k, s1: 2.4 * k, col: [0.0, 0.0, 0.0], k: 0.6, shape: SHAPE.lines, rot: rnd(0, 6) });
      put(glow, { p: c, t0: t, life: 80, s0: 0.35 * k, s1: 0.5 * k, rot: rnd(0, 1), col: P.glow, k: 0.9, shape: SHAPE.star });
      const sh = decal(SHOCK_FS, g, (heavy ? 1.3 : 1.0) * k, 380, { uTint: C(P.glow.map((x) => x * 0.8)) }); sh.env = "u";
      // the blow runs through the board: from the god's feet through its target and on (STREAK_FS), light racing ahead
      const STYLE = { array: 0, pillar: 1, collapse: 2, spear: 3 }, style = STYLE[fx.cast] ?? 1, base = (u.pos || u.fig.root.position).clone().setY(0);
      const from = base.clone().addScaledVector(dir, 0.3 * k), to = g.clone().addScaledVector(dir, (heavy ? 3.2 : 2.6) * k), span = from.distanceTo(to) || 1;
      streak(from, to, (style === 0 ? 0.42 : 0.62) * k, style === 0 ? 1500 : 2200, Math.min(0.95, from.distanceTo(g) / span), 230, style, P);
      for (let i = 0; i < 7; i++) {
        const p = g.clone().addScaledVector(dir, (i / 6) * (heavy ? 3.2 : 2.6) * k).setY(0.08 * k);
        put(glow, { p, t0: t + i * 32, life: 200, s0: 0.22 * k, s1: 0.1 * k, col: P.glow, k: 1.1, shape: SHAPE.glow, env: "pop" });
        put(glow, { p, v: V3(rnd(-0.4, 0.4), rnd(0.8, 1.6), rnd(-0.4, 0.4)).multiplyScalar(k), grav: 3 * k, t0: t + i * 32, life: rnd(260, 420), s0: 0.014 * k, s1: 0.008 * k, col: P.core, k: 1.4, shape: SHAPE.spark, env: "fade", stretch: 0.05, floor: 0.01 });
      }
      if (style === 3) spikeLine(g.clone().addScaledVector(dir, 0.4 * k), to, g, k, P);
      if (fx.cast === "array") {                       // the sun's judgment: a great crossed cut, a sun stamped on the ground
        for (const [d0, life] of [[0.8, 320], [-0.8, 360]]) put(glow, { p: c, t0: t + (d0 < 0 ? 50 : 0), life, s0: 0.5 * k, s1: 1.25 * k, rot: d0, col: P.glow, k: 1.1, shape: SHAPE.cut, env: "pop" });
        const sg = decal(SIGIL_FS, g, 0.75 * k, 900, { uTint: C(P.glow.map((x) => x * 0.7)), uStyle: { value: 0 } }); sg.env = "pop"; sg.spin = 2;
        decal(CRACK_FS, g, 0.75 * k, 1500, { uHot: C(P.glow), uMid: C(P.glow.map((x) => x * 0.8)), uCool: C(P.deep) }).env = "crack";
        bits("shard", c, heavy ? 12 : 8, k, P, dir, t);
      } else if (fx.cast === "pillar") {               // the pillar stands; the ground under it molten
        decal(CRACK_FS, g, 0.85 * k, 2000, { uHot: C(P.core), uMid: C(P.glow), uCool: C(P.deep) }).env = "crack";
        decal(SCORCH_FS, g, 0.75 * k, 2200, { uTint: { value: new THREE.Color(0.03, 0.015, 0.01) } }, true).env = "late";
        if (o.fire) later.push({ at: t + 220, fn: () => o.fire.burst(c.clone().add(V3(0, 0.45 * k, 0)), 0.035 * k) });
      } else if (fx.cast === "collapse") {             // the collapse bursts: a black ring out, crescents cut outward, the dark pool
        const vp = decal(VOID_FS, g, 1.0 * k, 1600, {}, true); vp.env = "late"; vp.spin = 1.6;
        const s2 = decal(SHOCK_FS, g, 1.6 * k, 620, { uTint: C(P.glow.map((x) => x * 0.6)) }); s2.env = "u";
        put(dark, { p: c, t0: t, life: 260, s0: 0.2 * k, s1: 1.3 * k, col: [0.02, 0.0, 0.04], k: 0.9, shape: SHAPE.ring, env: "pop" });
        put(glow, { p: c, t0: t, life: 260, s0: 0.25 * k, s1: 1.45 * k, col: P.glow, k: 1.0, shape: SHAPE.ring, env: "pop" });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * 6.2832 + rnd(-0.2, 0.2), d = V3(Math.cos(a), rnd(-0.25, 0.35), Math.sin(a)).normalize();
          put(glow, { p: c, v: d.multiplyScalar(2.6 * k), drag: 3.2, t0: t, life: 340, s0: 0.2 * k, s1: 0.32 * k, col: P.core.map((x) => x * 0.7), k: 1.2, shape: SHAPE.arc, env: "pop", stretch: 1e-4 });
        }
        bits("wisp", c, 8, k, P, null, t);
      } else if (fx.cast === "spear") {                // the wild answers: roots split the ground, thorns burst up
        decal(CRACK_FS, g, 0.8 * k, 1600, { uHot: C(P.core), uMid: C(P.glow), uCool: C(P.deep), uRoot: { value: 1 } }).env = "crack";
        spikeRing("thorn", g, k, heavy, P, dir); bits("leaf", c, 8, k, P, dir, t);
      }
      for (let i = 0, n = heavy ? 18 : 12; i < n; i++) {
        const v = inBall().setY(0).normalize().multiplyScalar(0.5).add(dir.clone().multiplyScalar(rnd(0.3, 0.9))).setY(rnd(0.5, 1.4)).normalize().multiplyScalar(rnd(1.8, 3.2) * k);
        put(glow, { p: c, v, grav: 6 * k, drag: 1.8, t0: t, life: rnd(220, 420), s0: 0.016 * k, s1: 0.01 * k, col: Math.random() < 0.4 ? P.core : P.glow, k: 1.5, shape: SHAPE.spark, env: "fade", stretch: 0.05, floor: 0.01 });
      }
      shakes.push({ t0: t, a: (heavy ? 0.05 : 0.034) * k * (fx.shake || 1), life: heavy ? 340 : 260 });
      punches.push({ t0: t, a: heavy ? 0.09 : 0.06, life: 420 });
    }
    // hurt: a shield bearer's shield flares where the blow meets it; anyone else flashes at the chest, its element
    // scattering
    function hurt(u, from) {
      const k = K(u), now = performance.now(), f = u.fig, fx = recipe(u), P = palOf(fx);
      const h = fx.hurt === "shield" ? bone(f, "LeftForeArm") || bone(f, "LeftHand") : bone(f, "Spine2");
      if (!h) return;
      const p = h.getWorldPosition(V3()), d = from?.fig ? from.fig.root.position.clone().sub(f.root.position).setY(0).normalize() : V3(0, 0, 1);
      p.addScaledVector(d, 0.08 * k);
      put(glow, { p, t0: now, life: 160, s0: 0.45 * k, s1: 0.6 * k, col: P.core.map((x) => x * 0.8), k: 1.0, shape: SHAPE.glow });
      put(glow, { p, t0: now, life: 200, s0: 0.6 * k, s1: 0.75 * k, rot: rnd(0, 1), col: P.glow, k: fx.hurt === "shield" ? 1.1 : 0.7, shape: SHAPE.star });
      for (let i = 0; i < 10; i++) put(glow, { p, v: d.clone().multiplyScalar(0.8).add(inBall()).normalize().multiplyScalar(rnd(1.0, 2.0) * k), grav: 5 * k, drag: 2, t0: now, life: rnd(200, 380), s0: 0.016 * k, s1: 0.01 * k, col: P.glow, k: 1.4, shape: SHAPE.spark, env: "fade", stretch: 0.05 });
      if (fx.bits && fx.hurt !== "shield") bits(fx.bits, p, 3, k * 0.8, P, d);
      stOf(u).flash = now - 120;
    }
    // victory: a ray comes down onto the raised weapon (a star burns at its point); a sun or a moon rises behind; the
    // sigil opens underfoot; its element falls round it and motes rise
    function victory(u) {
      const s = stOf(u), k = K(u), now = performance.now(), p = u.fig.root.position, fx = recipe(u), P = palOf(fx), V = fx.victory || {};
      s.vic = now;
      const tip = u.fig.blade?.[1];
      if (V.ray !== false && tip) {
        const b = beam(p.clone(), 3.2 * k, 0.16 * k, 1700, P.glow.map((x) => x * 0.8), 0.75, "hold"); b.t0 = now + 300; b.track = tip;
        put(glow, { p, track: tip, t0: now + 300, life: 1600, s0: 0.5 * k, s1: 0.7 * k, rot: 0, spin: 0.6, col: P.glow, k: 0.8, shape: SHAPE.star, env: "hold" });
        put(glow, { p, track: tip, t0: now + 300, life: 1600, s0: 0.14 * k, s1: 0.14 * k, col: P.core, k: 1.2, shape: SHAPE.sparkle, env: "hold" });
      }
      if (V.orb) {                                     // a sun, a moon or a star behind the head
        const head = bone(u.fig, "Head");
        const sh = V.orb === "moon" ? SHAPE.crescent : V.orb === "star" ? SHAPE.star5 : SHAPE.star;
        put(glow, { p, track: head || u.fig.root, off: V3(0, 0.12 * k, 0).addScaledVector(V3(0, 0, -1).applyQuaternion(u.fig.root.quaternion), 0.12 * k), t0: now + 200, life: 1900, s0: 0.35 * k, s1: 0.6 * k, rot: V.orb === "moon" ? 3.4 : 0, spin: V.orb === "moon" ? 0 : 0.4, col: P.glow.map((x) => x * 0.6), k: 0.6, shape: sh, env: "hold" });
        put(glow, { p, track: head || u.fig.root, off: V3(0, 0.12 * k, 0), t0: now + 200, life: 1900, s0: 0.45 * k, s1: 0.65 * k, col: P.glow.map((x) => x * 0.3), k: 0.5, shape: SHAPE.glow, env: "hold" });
      }
      const d = decal(SIGIL_FS, p, 0.8 * k, 2100, { uTint: C(P.glow.map((x) => x * 0.8)), uStyle: { value: SIGILS[fx.sigil] ?? 0 } }); d.env = "hold"; d.spin = 0.7;
      const rain = V.rain || fx.bits || "feather";
      for (let i = 0; i < 12; i++) {
        const a = rnd(0, 6.28), R = rnd(0.15, 0.6) * k, at = p.clone().add(V3(Math.cos(a) * R, rnd(1.5, 2.3) * k, Math.sin(a) * R));
        if (rain === "rock") { if (i < 6) rockBurst(p.clone().add(V3(Math.cos(a) * R * 1.5, 0, Math.sin(a) * R * 1.5)), 1, k, P, 0.6); continue; }
        const shape = rain === "star" ? SHAPE.star5 : SHAPE[rain] ?? SHAPE.feather;
        put(glow, { p: at, v: V3(0, -rnd(0.12, 0.25) * k, 0), sway: 0.2 * k, t0: now + rnd(250, 900), life: rnd(1700, 2300), s0: (rain === "snow" ? 0.05 : rain === "wisp" ? 0.07 : 0.09) * k, s1: 0.07 * k, rot: rnd(0, 6.28), spin: rnd(-1.6, 1.6), col: rain === "leaf" ? P.leaf || P.glow : rain === "feather" ? [1.9, 1.45, 0.7] : P.mote, k: 1, shape, env: "late", stretch: rain === "wisp" ? 0.2 : 0 });
      }
      for (let i = 0; i < 26; i++) {
        const a = rnd(0, 6.28), R = rnd(0.2, 0.5) * k;
        put(glow, { p: p.clone().add(V3(Math.cos(a) * R, rnd(0, 0.3) * k, Math.sin(a) * R)), v: V3(-Math.sin(a) * 0.3 * k, rnd(0.4, 0.9) * k, Math.cos(a) * 0.3 * k), drag: 0.5, t0: now + rnd(200, 1200), life: rnd(1000, 1600), s0: 0.03 * k, s1: 0.015 * k, col: P.mote, k: 1.3, shape: SHAPE.sparkle, env: "mote" });
      }
      if (V.flame && o.fire) for (let i = 0; i < 3; i++) later.push({ at: now + 300 + i * 260, fn: () => o.fire.burst(p.clone().add(V3(0, 0.2 * k, 0)), 0.05 * k) });
      if (V.shock) { later.push({ at: now + 250, fn: () => { decal(SHOCK_FS, p, 1.4 * k, 600, { uTint: C(P.glow) }).env = "u"; shakes.push({ t0: NOW(), a: 0.03 * k, life: 300 }); } }); }
    }
    // every frame, once the figure is posed: the weapon's light, the charge, the glint, the swoosh, the calls, the
    // idle aura
    function frame(u, now) {
      const f = u.fig;
      if (!f?.sig) {                                   // not (or no longer) a signature: its lights out
        const s = state.get(u);
        if (s) { if (s.halo) s.halo.k = 0; if (f?.bladeK) { f.bladeK.value = 0; f.rimK.value = 0; } }
        return;
      }
      const s = stOf(u), k = K(u), A = s.atk, fx = recipe(u), P = palOf(fx), weapon = !!f.blade && fx.weapon !== false;
      // what charges and swooshes: the weapon, a limb (a kick, a punch), or else the casting hand (a named one: the free
      // hand of one that carries a lantern)
      const limb = !weapon && fx.limb ? fx.limb.map((n) => bone(f, n)?.getWorldPosition(V3())) : null;
      const pts = weapon ? blade(f) : limb?.every(Boolean) ? limb : null, hand = !pts ? (fx.castHand ? bone(f, fx.castHand)?.getWorldPosition(V3()) : o.hand?.(u)) : null;
      let bk = 0.28 + 0.1 * Math.sin(now * 0.0021 + f.phase), rim = 0;
      if (A) {
        const q = (now - A.t0) / A.align, dt = Math.min(0.05, (now - (A.last ?? now)) / 1000);
        if (q < 1) { bk = 0.35 + 1.8 * Math.min(1, Math.max(0, (q - 0.08) / 0.7)); rim = 0.55 * Math.min(1, q / 0.8); }
        // light streams into the weapon (or the casting hand) through the charge
        if (q < 0.92 && (pts || hand)) for (A.charge += (40 + 120 * q) * dt; A.charge >= 1; A.charge--) {
          const at = pts ? pts[0].clone().lerp(pts[1], Math.random()) : hand.clone(), from = at.clone().add(inBall().normalize().multiplyScalar(rnd(0.25, 0.45) * k));
          put(glow, { p: from, pull: at, pullK: 9, t0: now, life: rnd(220, 320), s0: 0.03 * k, s1: 0.012 * k, col: Math.random() < 0.3 ? P.core : P.mote, k: 1.4, shape: fx.chargeShape ? SHAPE[fx.chargeShape] : SHAPE.sparkle, env: "mote" });
        }
        // a god's column of light round it as it charges
        if (fx.rise && !f.spell && q < 1) for (A.rise += 60 * dt; A.rise >= 1; A.rise--) {
          const a = rnd(0, 6.28), R = rnd(0.28, 0.42) * k, base = f.root.position;
          put(glow, { p: base.clone().add(V3(Math.cos(a) * R, rnd(0, 0.2) * k, Math.sin(a) * R)), v: V3(0, rnd(1.0, 1.8) * k, 0), t0: now, life: 700, s0: 0.035 * k, s1: 0.02 * k, col: P.mote, k: 1.3, shape: fx.riseShape ? SHAPE[fx.riseShape] : SHAPE.sparkle, env: "mote", rot: rnd(0, 6), spin: rnd(-3, 3) });
        }
        // the glint rides the point at the top of the swing, gone as the weapon comes down
        if (weapon && !A.glint && q >= 0.7 && fx.modern) { A.glint = true; put(glow, { p: pts[1], track: f.blade[1], t0: now, life: 160, s0: 0.12 * k, s1: 0.2 * k, col: P.glow, k: 1.1, shape: SHAPE.sparkle }); }
        if (weapon && !A.glint && q >= 0.7) { A.glint = true; put(glow, { p: pts[1], track: f.blade[1], t0: now, life: 170, s0: 0.3 * k, s1: 0.4 * k, rot: 0.3, spin: 3, col: P.core.map((x) => x * 0.6), k: 1.2, shape: SHAPE.star }); put(glow, { p: pts[1], track: f.blade[1], t0: now, life: 150, s0: 0.2 * k, s1: 0.1 * k, col: P.core, k: 1.4, shape: SHAPE.sparkle }); }
        // the swoosh
        if (pts && fx.trail !== false && q >= (fx.trailFrom ?? 0.76) && !A.rib) { A.rib = ribbon(P.trail, P.core.map((x) => x * 0.55), fx.trailInner ?? 0.5); o.add(A.rib.mesh); ribs.push(A.rib); }
        const R = A.rib;
        if (R && R.open && !(R.stop && now > R.stop)) {
          const prev = R.S[R.S.length - 1], sp = prev ? prev.tp.distanceTo(pts[1]) / Math.max(1e-3, (now - prev.t) / 1000) / k : 0;
          if (!prev || prev.tp.distanceToSquared(pts[1]) > 1e-8) R.S.push({ b: pts[0], tp: pts[1], t: now, g: Math.min(1, Math.max(0, (sp - 1.2) / 3.5)) });
          if (R.S.length > RIB_MAX) R.S.shift();
        } else if (R) R.open = false;
        // a lantern-bearer's lantern gathers the light while the free hand casts, and dims after
        if (fx.lantern) f.glow.c.value.set(...P.glow).multiplyScalar(0.8);
        if (fx.lantern) f.glow.k.value = q < 1 ? 1.5 * Math.min(1, q * 1.3) : 1.5 * Math.exp(-(now - A.t0 - A.align) / 320);
        // the calls: stars fall onto the foe (the last of them on the blow), the dead rise under it
        const T = A.target?.();
        // the gods (each its own shape of power): the sun god's wheel of blades behind him, loosed at his foe · the
        // star-flame god's marked ground, a vortex of fire torn up out of it · the dark-moon goddess's rift, a black hole
        // opening in it that swallows the light and collapses
        if (T && fx.cast === "array") castArray(u, A, q, now, T, P, k, fx);
        if (T && fx.cast === "pillar") castPillar(u, A, q, now, T, P, k, fx);
        if (T && fx.cast === "collapse") castCollapse(u, A, q, now, T, P, k, fx);
        // a god's spear of the wild: it leaves the spear's point as a lance of light and runs its prey through on the blow
        if (T && fx.cast === "spear" && !A.thrown && q >= 0.8) {
          A.thrown = true;
          const from = pts ? pts[1].clone() : f.root.position.clone().add(V3(0, 0.6 * k, 0));
          missile(from, T.center, now, A.t0 + A.align, { arc: 0.06 * k, trail: P.mote, heads: [{ s0: 0.38 * k, s1: 0.38 * k, col: P.glow, k: 1.2, shape: SHAPE.blade, stretch: 1e-4 }, { s0: 0.05 * k, s1: 0.05 * k, col: P.core.map((x) => x * 0.7), k: 1.0, shape: SHAPE.spark, stretch: 0.03 }] });
        }
        if (T && fx.cast === "sky" && o.fire) {
          const lands = [0.78, 0.93, 1.06];
          while (A.calls < lands.length && q >= lands[A.calls] - 280 / A.align) {
            const off = V3(rnd(-0.12, 0.12), 0, rnd(-0.12, 0.12)).multiplyScalar(k), to = T.center.clone().add(off);
            o.fire.shoot(to.clone().add(V3(-0.5 * k, 2.4 * k, 0.3 * k)), to, 280, 0.05 * k, fx.look || { mode: "energy", tint: P.glow });
            later.push({ at: now + 280, fn: () => { put(glow, { p: to, t0: NOW(), life: 160, s0: 0.5 * k, s1: 0.7 * k, rot: rnd(0, 1), col: P.glow, k: 0.9, shape: SHAPE.star }); decal(SHOCK_FS, T.ground, 0.7 * k, 320, { uTint: C(P.glow) }).env = "u"; bits("star", to, 3, k, P); } });
            A.calls++;
          }
        }
        if (T && fx.cast === "ground" && q >= 0.85 && !A.calls) {
          A.calls = 1;
          for (let i = 0; i < 16; i++) { const a = rnd(0, 6.28), Rr = rnd(0.05, 0.3) * k; put(glow, { p: T.ground.clone().add(V3(Math.cos(a) * Rr, 0.02, Math.sin(a) * Rr)), v: V3(0, rnd(0.8, 1.6) * k, 0), drag: 0.8, t0: now + rnd(0, 300), life: rnd(500, 800), s0: 0.07 * k, s1: 0.04 * k, col: P.mote, k: 1.1, shape: SHAPE.wisp, env: "mote", stretch: 0.2 }); }
        }
        // the sun over the foe: the blow comes down from it as a column of light
        if (A.sky && !A.skyFell && q >= 1) { A.skyFell = true; if (T) beam(T.ground, 2.2 * k, 0.5 * k, 420, P.glow, 1.2, "flash"); }
        // no contact came (the blow was taken on a shield, or nothing stood there): the weapon still meets the ground
        if (!A.hit && !f.spell && q > 1 + 90 / A.align) {
          const fwd = V3(0, 0, 1).applyQuaternion(f.root.getWorldQuaternion(new THREE.Quaternion())).setY(0).normalize();
          const g = f.sig?.stay && T ? T.ground.clone() : pts ? V3(pts[1].x, 0, pts[1].z) : f.root.position.clone().addScaledVector(fwd, 0.35 * k).setY(0);
          impact(u, { at: g.clone().setY(0.35 * k), ground: g, dir: fwd }, A.tier);
        }
        A.last = now;
        if (now - A.t0 > A.align + 1600) { if (A.rib) A.rib.open = false; s.atk = null; }
      }
      const since = now - s.flash;
      if (since < 700) { bk = Math.max(bk, 2.4 * Math.exp(-since / 200) + 0.5); rim = Math.max(rim, 0.5 * Math.exp(-since / 220)); }
      if (s.vic) {
        const v = (now - s.vic) / 1000;
        if (v < 2.2) { const e = Math.min(1, Math.max(0, (v - 0.25) / 0.3)) * (v < 1.8 ? 1 : 1 - (v - 1.8) / 0.4); bk = Math.max(bk, 2.6 * e); rim = Math.max(rim, 0.8 * e); }
        else s.vic = 0;
      }
      if (f.bladeK) { f.bladeK.value = weapon ? bk : 0; f.bladeT.value = now / 1000; f.rimK.value = rim; }
      // at rest: its element drifts round it now and then, and a faint sigil turns on its station
      const au = fx.aura || {};
      if (u.clip === "idle" && now - s.aura > (au.every ?? 420)) {
        s.aura = now;
        const a = rnd(0, 6.28), R = rnd(0.18, 0.34) * k, base = u.pos || f.root.position, sh = au.bits || "sparkle";
        const falls = sh === "snow" || sh === "leaf" || sh === "feather";
        put(glow, { p: base.clone().add(V3(Math.cos(a) * R, (falls ? rnd(0.8, 1.2) : rnd(0.05, 0.7)) * k, Math.sin(a) * R)), v: V3(0, (falls ? -rnd(0.08, 0.14) : rnd(0.08, 0.16)) * k, 0), sway: (falls ? 0.1 : 0.03) * k, t0: now, life: rnd(1800, 2600),
          s0: (sh === "sparkle" ? 0.028 : 0.05) * k, s1: (sh === "sparkle" ? 0.02 : 0.045) * k, rot: rnd(0, 6.28), spin: falls ? rnd(-1.5, 1.5) : 0, col: sh === "leaf" ? P.leaf || P.glow : P.mote, k: 1.1, shape: SHAPE[sh] ?? SHAPE.sparkle, env: "mote", stretch: sh === "wisp" ? 0.25 : 0 });
      }
      if (o.halo !== false && au.halo !== false && u.uid !== "hero") {   // (a hero's dais has its own halo: EmberVoxelArena)
        if (!s.halo) { s.halo = decal(SIGIL_FS, u.pos || f.root.position, 0.4 * k, Infinity, { uTint: C(P.glow.map((x) => x * 0.8)), uStyle: { value: SIGILS[fx.sigil] ?? 0 } }); s.halo.env = "halo"; s.halo.spin = 0.25; }
        const base = u.pos || f.root.position;
        s.halo.m.position.set(base.x, 0.005, base.z); s.halo.m.scale.setScalar(0.4 * k);
        s.halo.k = (u.clip === "idle" ? 0.1 : 0.05) + 0.025 * Math.sin(now * 0.002);
      }
    }
    function step(now, camera) {
      const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000); last = now; cam = camera;
      for (let i = meshes.length - 1; i >= 0; i--) {
        const M = meshes[i], u = (now - M.t0) / M.life;
        if (u >= 1) { M.kill(); meshes.splice(i, 1); continue; }
        M.stepFn(Math.max(0, u), now);
      }
      for (let i = later.length - 1; i >= 0; i--) if (now >= later[i].at) { const j = later.splice(i, 1)[0]; j.fn(); }
      for (let i = missiles.length - 1; i >= 0; i--) {
        const M = missiles[i], u = (now - M.t0) / Math.max(1, M.t1 - M.t0);
        if (u < 0) continue;
        const q = Math.min(1, u), pos = M.from.clone().lerp(M.to, q).add(V3(0, M.arc * Math.sin(Math.PI * q), 0));
        const vel = dt > 0 ? pos.clone().sub(M.prev).divideScalar(dt) : V3();
        M.obj.position.copy(pos); M.prev.copy(pos);
        for (const h of M.heads) h.v.copy(vel);
        if (M.trail) for (M.shed += 90 * dt; M.shed >= 1; M.shed--) put(glow, { p: pos.clone().add(inBall().multiplyScalar(0.02)), v: inBall().multiplyScalar(0.3), drag: 2, t0: now, life: rnd(200, 360), s0: 0.03, s1: 0.012, col: M.trail, k: 1.3, shape: SHAPE.sparkle, env: "mote" });
        if (u >= 1) { missiles.splice(i, 1); M.land?.(pos); }
      }
      syncPool(glow, now, dt); syncPool(smoke, now, dt); syncPool(dark, now, dt); syncRocks(rocks, now, dt); syncSpikes(spikes, now);
      smoke.mesh.material.uniforms.uTime.value = now / 1000;
      for (let i = decals.length - 1; i >= 0; i--) {
        const d = decals[i], u = (now - d.t0) / d.life, U = d.m.material.uniforms;
        if (u >= 1) { kill(d.m); decals.splice(i, 1); continue; }
        const q = Math.max(0, u);
        U.uRot.value = (d.spin || 0) * (now - d.t0) / 1000;
        if (d.env === "u") { U.uU.value = q; U.uK.value = u < 0 ? 0 : 1; }
        else if (d.env === "rev") { U.uU.value = 1 - q; U.uK.value = u < 0 ? 0 : 0.6 + 0.4 * q; }       // a ring closing in
        else if (d.env === "zone") { U.uFill.value = d.fill ?? 0; U.uRot.value = d.rot ?? 0; U.uK.value = d.k ?? 1; }
        else if (d.env === "pre") { U.uGrow.value = d.grow ?? 0; U.uAge.value = d.age ?? 0.5; U.uK.value = 0.9; }
        else if (d.env === "crack") { U.uAge.value = q; U.uGrow.value = 1 - Math.pow(1 - Math.min(1, (now - d.t0) / 110), 3); }
        else if (d.env === "halo") U.uK.value = d.k ?? 0.1;
        else if (d.env === "streak") { const f = Math.min(1, Math.max(0, now - d.t0) / d.sweep); U.uAge.value = q; U.uFront.value = d.x0 + (1 - d.x0) * (1 - Math.pow(1 - f, 2)); U.uK.value = u < 0 ? 0 : 1; }
        else U.uK.value = u < 0 ? 0 : (ENV[d.env] || ENV.pop)(q) * 1.3 * (d.gain ?? 1);
      }
      for (let i = beams.length - 1; i >= 0; i--) {
        const b = beams[i], u = (now - b.t0) / b.life, U = b.m.material.uniforms;
        if (u >= 1) { kill(b.m); beams.splice(i, 1); continue; }
        U.uK.value = u < 0 ? 0 : b.k * ENV[b.env](u); U.uTime.value = now / 1000;
        if (b.track) { b.track.updateWorldMatrix(true, false); b.track.getWorldPosition(b.m.position); }
        b.m.rotation.set(0, Math.atan2(camera.position.x - b.m.position.x, camera.position.z - b.m.position.z), 0);
      }
      for (let i = ribs.length - 1; i >= 0; i--) {
        const R = ribs[i];
        buildRibbon(R, now);
        R.mesh.material.uniforms.uTime.value = now / 1000;
        if (!R.open && !R.S.length) { o.remove(R.mesh); R.mesh.geometry.dispose(); R.mesh.material.dispose(); ribs.splice(i, 1); }
      }
      for (let i = shakes.length - 1; i >= 0; i--) if (now - shakes[i].t0 > shakes[i].life) shakes.splice(i, 1);
      return !!(glow.P.length || smoke.P.length || dark.P.length || meshes.length || rocks.P.length || spikes.P.length || beams.length || ribs.length || later.length || missiles.length);
    }
    /** a plain (not signature) model's swoosh: a steel ribbon behind its weapon while `on` (the blow's window) */
    function swing(u, on, now) {
      const f = u.fig; if (!f?.blade) return;
      const s = stOf(u);
      if (on) {
        if (!s.plain || !s.plain.open) { s.plain = ribbon([0.55, 0.6, 0.72], [1.1, 1.15, 1.25], 0.45); o.add(s.plain.mesh); ribs.push(s.plain); }
        const [b0, b1] = blade(f), R = s.plain, prev = R.S[R.S.length - 1], k = K(u), sp = prev ? prev.tp.distanceTo(b1) / Math.max(1e-3, (now - prev.t) / 1000) / k : 0;
        if (!prev || prev.tp.distanceToSquared(b1) > 1e-8) R.S.push({ b: b0, tp: b1, t: now, g: Math.min(1, Math.max(0, (sp - 1.2) / 3.5)) });
        if (R.S.length > RIB_MAX) R.S.shift();
      } else if (s.plain) { s.plain.open = false; s.plain = null; }
    }
    /** the camera's punch now (× its distance: in toward the blow, and back) */
    function punch(now) {
      let a = 0;
      for (let i = punches.length - 1; i >= 0; i--) { const p = punches[i], u = (now - p.t0) / p.life; if (u >= 1) { punches.splice(i, 1); continue; } if (u >= 0) a = Math.max(a, p.a * (u < 0.12 ? u / 0.12 : Math.pow(1 - (u - 0.12) / 0.88, 2))); }
      return a;
    }
    /** how far the stage is dimmed now (0 – 1) round a god's blow */
    function dim(now) {
      let a = 0;
      for (let i = dims.length - 1; i >= 0; i--) {
        const d = dims[i]; if (now > d.hold + 380) { dims.splice(i, 1); continue; }
        a = Math.max(a, d.a * (now < d.peak ? Math.max(0, (now - d.t0) / (d.peak - d.t0)) : now < d.hold + 80 ? 1 : 1 - (now - d.hold - 80) / 300));
      }
      return a;
    }
    /** the camera's shake now: a decaying jolt per blow (world units) */
    function shake(now) {
      let a = 0;
      for (const s of shakes) { const u = (now - s.t0) / s.life; if (u >= 0 && u < 1) a += s.a * (1 - u) * (1 - u); }
      return a;
    }
    /** something fast is on (a blow's meshes, beams, swooshes, debris, ground marks, shake) — not the idle motes */
    const hot = () => !!(meshes.length || beams.length || ribs.length || later.length || missiles.length || rocks.P.length || spikes.P.length ||
      shakes.length || punches.length || dims.length || decals.some((d) => d.env !== "halo"));
    function drop(u) { const s = state.get(u); if (!s) return; if (s.halo) s.halo.life = 0; if (s.plain) s.plain.open = false; if (s.atk?.rib) s.atk.rib.open = false; state.delete(u); }
    function dispose() {
      for (const d of decals) kill(d.m); for (const b of beams) kill(b.m);
      for (const R of ribs) { o.remove(R.mesh); R.mesh.geometry.dispose(); R.mesh.material.dispose(); }
      for (const pl of [glow, smoke, dark, rocks, spikes]) { o.remove(pl.mesh); pl.mesh.geometry.dispose(); pl.mesh.material.dispose(); }
      for (const M of meshes) M.kill();
      decals.length = beams.length = ribs.length = later.length = missiles.length = meshes.length = 0; state.clear();
    }
    return { attack, impact, hurt, victory, frame, swing, step, shake, punch, dim, drop, dispose, hot };
  }
  return Object.freeze({ create, PAL: Object.keys(PAL) });
})();
