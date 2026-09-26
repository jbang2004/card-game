/* EmberFire — spell light for the 3D figures (docs/design/MINIATURES.md): fire, and energy of any colour (holy gold,
 * shadow violet, soul blue, blood red, fey green). Every flame is a camera-facing quad whose shader draws it: fractal
 * noise scrolling upward (the flames lick up), cut by a round core; fire is coloured along the black-body ramp
 * (white-yellow heart → orange → deep red), energy along its tint (a white-hot heart in a coloured glow). All of it is
 * added onto what is behind it.
 *   ball({ r })            → { obj, update(T, k) }   a fireball held in a hand (k scales it; 0 hides it)
 *   system(add, remove)    → a spell's life in a scene:
 *     gather(hand, feet, ms, r, look, o)   the charge: motes stream into the casting hand from all round, an orb of
 *                                          the spell grows there, a rune circle turns under the caster's feet
 *                                          (o.orb false: the hand holds its own), a column of motes rises (o.rise)
 *     orbit(centre, ms, R, look)           motes whirling round a figure (a sprite's spin)
 *     shoot(from, to, ms, r, look)         the bolt in flight with its trail; bursts where it lands
 *     burst(p, r, look), step(now)
 *   look = { mode: "fire" | "energy", tint: [r, g, b] (linear, may exceed 1) }
 * Pure presentation: no game state. */
const EmberFire = (() => {
  const THREE = EmberVesperThree, V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const VS = /* glsl */ `
    uniform float uSize; varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      mv.xy += position.xy * uSize * length(modelMatrix[0].xyz);
      gl_Position = projectionMatrix * mv;
    }`;
  // uShape 0: a ball (round core, flames licking up round it) · 1: a puff (a soft billow that burns out as uAge → 1)
  // · 2: a mote (a sharp point of light with a four-point glint). uMode 0: fire · 1: energy tinted uTint
  const FS = /* glsl */ `
    uniform float uTime, uSeed, uK, uShape, uAge, uMode; uniform vec3 uTint; varying vec2 vUv;
    float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
    vec3 ramp(float t) {                                   // black body: deep red → orange → yellow → white
      t = clamp(t, 0.0, 1.0);
      vec3 c = mix(vec3(0.5, 0.04, 0.0), vec3(1.6, 0.42, 0.05), smoothstep(0.0, 0.4, t));
      c = mix(c, vec3(2.4, 1.3, 0.3), smoothstep(0.35, 0.7, t));
      return mix(c, vec3(3.0, 2.7, 1.9), smoothstep(0.75, 1.0, t));
    }
    vec3 glow(float t) {                                   // energy: its colour deepening at the rim, white at the heart
      t = clamp(t, 0.0, 1.3);
      return uTint * (0.25 + 1.1 * smoothstep(0.0, 0.6, t)) + vec3(1.0) * smoothstep(0.7, 1.2, t) * 1.1;
    }
    void main() {
      vec2 q = vUv * 2.0 - 1.0;
      float t = uTime + uSeed, heat;
      if (uShape < 0.5) {
        // the ball: a core with a turbulent rim; above it the rim is pulled up into tongues of flame (energy swirls)
        float up = max(q.y, 0.0) * (1.0 - 0.6 * uMode);
        vec2 w = vec2(fbm(q * 2.2 + vec2(0.0, -t * 2.4)), fbm(q * 2.2 + vec2(5.2, -t * 2.9)));
        float r = length(vec2(q.x * (1.0 + 0.5 * up), q.y - 0.12 * (1.0 - uMode)) + (w - 0.5) * (0.35 + 0.5 * up));
        float lick = fbm(vec2(q.x * 3.0, q.y * 1.6 - t * 3.2)) * up * 0.9;
        heat = (1.0 - smoothstep(0.1, 0.62, r - lick * 0.35)) * (0.72 + 0.55 * fbm(q * 3.5 + vec2(0.0, -t * 3.0)));
        heat += 0.55 * (1.0 - smoothstep(0.0, 0.32, length(q - vec2(0.0, 0.05 * (1.0 - uMode)))));
      } else if (uShape < 1.5) {
        float r = length(q) + (fbm(q * 2.5 + vec2(uSeed, -t * 1.5)) - 0.5) * 0.7;
        heat = (1.0 - smoothstep(0.15, 0.85, r)) * (1.0 - uAge * 0.85) * (0.6 + 0.6 * fbm(q * 3.0 + uSeed));
      } else {
        float r = length(q), glint = exp(-abs(q.x) * 24.0) * exp(-abs(q.y) * 3.0) + exp(-abs(q.y) * 24.0) * exp(-abs(q.x) * 3.0);
        heat = exp(-r * 7.0) * 1.4 + 0.45 * glint * (1.0 - r);
      }
      heat *= uK;
      float a = smoothstep(0.03, 0.35, heat);
      vec3 col = (uMode < 0.5 ? ramp(heat) : glow(heat)) * a;
      gl_FragColor = vec4(col, 0.0);
      gl_FragColor = linearToOutputTexel(gl_FragColor);
    }`;
  // the rune circle on the ground: rings, a turning band of runes, a six-point star, a soft centre
  const SIGIL_VS = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const SIGIL_FS = /* glsl */ `
    uniform float uK, uRot; uniform vec3 uTint; varying vec2 vUv;
    void main() {
      vec2 p = vUv * 2.0 - 1.0; float r = length(p), a = atan(p.y, p.x) + uRot;
      float ring = exp(-abs(r - 0.93) * 60.0) + 0.8 * exp(-abs(r - 0.72) * 70.0) + 0.5 * exp(-abs(r - 0.4) * 80.0);
      float runes = step(0.75, r) * step(r, 0.9) * step(0.5, fract(a * 24.0 / 6.2832)) * step(0.3, fract(a * 72.0 / 6.2832 + 0.5 * sin(a * 5.0)));
      float star = 0.0;
      for (int k = 0; k < 3; k++) { float th = a * 1.0 + float(k) * 1.0472; vec2 d = vec2(cos(th), sin(th)) * r; star += exp(-abs(d.y) * 90.0) * step(r, 0.72); }
      float c = ring + 0.7 * runes + 0.45 * star + 0.35 * exp(-r * 4.0);
      gl_FragColor = vec4(uTint * c * uK * (1.0 - smoothstep(0.95, 1.0, r)), 0.0);
      gl_FragColor = linearToOutputTexel(gl_FragColor);
    }`;
  const ADD = { transparent: true, depthWrite: false, depthTest: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
  const quad = new THREE.PlaneGeometry(1, 1), disc = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
  const FIRE = { mode: "fire", tint: [1, 0.5, 0.1] };
  function flame(shape, size, look = FIRE, seed = Math.random() * 50) {
    const m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, ...ADD,
      uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uK: { value: 1 }, uShape: { value: shape }, uAge: { value: 0 }, uSize: { value: size },
        uMode: { value: look.mode === "fire" ? 0 : 1 }, uTint: { value: new THREE.Color(...look.tint) } } });
    m.userData.toScreen = true;                         // already writes the output colour space
    const mesh = new THREE.Mesh(quad, m);
    mesh.frustumCulled = false; mesh.renderOrder = 15;
    return mesh;
  }
  function sigil(look) {
    const m = new THREE.Mesh(disc, new THREE.ShaderMaterial({ vertexShader: SIGIL_VS, fragmentShader: SIGIL_FS, side: THREE.DoubleSide, ...ADD,
      uniforms: { uK: { value: 0 }, uRot: { value: 0 }, uTint: { value: new THREE.Color(...look.tint) } } }));
    m.material.userData.toScreen = true; m.frustumCulled = false; m.renderOrder = 14;
    return m;
  }

  /** a fireball of radius r: two flames (a big licking ball, a hotter smaller one inside) */
  function ball({ r = 0.05, layer = null, look = FIRE } = {}) {
    const obj = new THREE.Group(), outer = flame(0, r * 3.2, look), inner = flame(0, r * 1.9, look);
    inner.material.uniforms.uK.value = 1.25;
    obj.add(outer, inner);
    if (layer != null) obj.traverse((o) => o.layers.set(layer));
    return {
      obj,
      update(T, k = 1) {
        obj.visible = k > 0.01;
        const f = 1 + 0.06 * Math.sin(T * 17) + 0.04 * Math.sin(T * 29);          // it flickers
        obj.scale.setScalar(Math.max(0.001, k) * f);
        outer.material.uniforms.uTime.value = T; inner.material.uniforms.uTime.value = T * 1.3;
      },
      dispose() { outer.material.dispose(); inner.material.dispose(); },
    };
  }

  /** a spell's life in a scene: add(mesh) / remove(mesh) put a flame into it */
  function system(add, remove) {
    const puffs = [], shots = [], gathers = [], orbits = [];
    let last = null;
    const drop = (m) => { remove(m); m.material.dispose(); };
    function puff(p, v, size, life, heat = 1, look = FIRE, shape = 1, pull = null) {
      const m = flame(shape, size, look); m.position.copy(p); add(m);
      puffs.push({ m, v: v.clone(), t0: performance.now(), life, heat, size, shape, pull });
    }
    const rnd = () => V3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    return {
      gather(hand, feet, ms, r, look, o = {}) {
        const g = { hand, feet, t0: performance.now(), ms, r, look, o, emit: 0, rise: 0, orb: null, ring: null, done: false };
        if (o.orb !== false) { g.orb = [flame(0, r * 3.2, look), flame(0, r * 1.9, look)]; g.orb[1].material.uniforms.uK.value = 1.25; g.orb.forEach(add); }
        g.ring = sigil(look); add(g.ring);
        gathers.push(g);
      },
      orbit(centre, ms, R, look) { orbits.push({ centre, t0: performance.now(), ms, R, look, emit: 0 }); },
      /** a bolt of radius r from `from` to `to` (Vector3s, world) arriving in ms */
      shoot(from, to, ms, r, look = FIRE) {
        const outer = flame(0, r * 3.2, look), inner = flame(0, r * 1.9, look);
        inner.material.uniforms.uK.value = 1.25;
        for (const m of [outer, inner]) { m.position.copy(from); add(m); }
        shots.push({ ms: [outer, inner], from: from.clone(), to: to.clone(), t0: performance.now(), dur: ms, r, look, emit: 0 });
      },
      burst(p, r, look = FIRE) {
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.3) * 1.2, s = r * (2 + Math.random() * 3);
          puff(p, V3(Math.cos(a) * s, Math.abs(e) * s + r * 2, Math.sin(a) * s), r * (1.6 + Math.random() * 1.4), 380 + Math.random() * 300, 1.3, look);
        }
        for (let i = 0; i < 16; i++) puff(p, rnd().normalize().multiplyScalar(r * (6 + Math.random() * 6)), r * 0.9, 420 + Math.random() * 300, 1.2, look, 2);
        puff(p, V3(0, r * 1.5, 0), r * 6, 260, 1.6, look);                           // the flash
      },
      step(now) {
        const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
        const T = now / 1000;
        // the charge
        for (let i = gathers.length - 1; i >= 0; i--) {
          const g = gathers[i], q = (now - g.t0) / g.ms, hp = g.hand(), fp = g.feet();
          if (!hp || !fp) { g.orb?.forEach(drop); drop(g.ring); gathers.splice(i, 1); continue; }
          if (q < 1) {
            const k = Math.min(1, q * 1.3);
            // motes stream in from all round, faster and thicker as it builds
            for (g.emit += dt * (40 + 140 * q); g.emit >= 1; g.emit--) {
              const from = hp.clone().add(rnd().normalize().multiplyScalar(g.r * (7 + Math.random() * 5)));
              puff(from, V3(), g.r * (0.9 + Math.random() * 0.8), 300 + Math.random() * 140, 1.3, g.look, 2, hp);
            }
            if (g.o.rise) for (g.rise += dt * 70; g.rise >= 1; g.rise--) {
              const a = Math.random() * Math.PI * 2, R = g.r * (5 + Math.random() * 3);
              puff(fp.clone().add(V3(Math.cos(a) * R, g.r * Math.random() * 3, Math.sin(a) * R)), V3(0, g.r * (14 + Math.random() * 10), 0), g.r * 1.1, 800, 1.2, g.look, 2);
            }
            g.orb?.forEach((m, j) => { m.position.copy(hp); m.scale.setScalar(Math.max(0.001, k * (1 + 0.08 * Math.sin(T * 19)))); m.material.uniforms.uTime.value = T * (j ? 1.3 : 1); });
            g.ring.position.set(fp.x, fp.y + 0.004, fp.z); g.ring.scale.setScalar(g.r * (8 + 3 * k));
            g.ring.material.uniforms.uK.value = 1.3 * Math.min(1, q * 2.5); g.ring.material.uniforms.uRot.value = T * 1.2;
          } else {
            if (!g.done) { g.done = true; g.orb?.forEach(drop); g.orb = null; puff(hp, V3(), g.r * 5, 200, 1.5, g.look); }
            const f = 1 - (q - 1) * g.ms / 450;                                   // the circle fades after the release
            g.ring.material.uniforms.uK.value = 1.3 * Math.max(0, f); g.ring.material.uniforms.uRot.value = T * 1.2;
            if (f <= 0) { drop(g.ring); gathers.splice(i, 1); }
          }
        }
        // the whirl
        for (let i = orbits.length - 1; i >= 0; i--) {
          const o = orbits[i], q = (now - o.t0) / o.ms, c = o.centre();
          if (q >= 1 || !c) { orbits.splice(i, 1); continue; }
          for (o.emit += dt * 200; o.emit >= 1; o.emit--) {
            const a = q * Math.PI * 4 + Math.random() * 0.6, y = (Math.random() - 0.3) * o.R;
            puff(c.clone().add(V3(Math.cos(a) * o.R, y, Math.sin(a) * o.R)), V3(-Math.sin(a), 0.3, Math.cos(a)).multiplyScalar(o.R * 1.5), o.R * 0.22, 600, 1.4, o.look, 2);
          }
        }
        for (let i = shots.length - 1; i >= 0; i--) {
          const s = shots[i], q = Math.min(1, (now - s.t0) / s.dur);
          const p = s.from.clone().lerp(s.to, q); p.y += Math.sin(q * Math.PI) * s.r * 2.5;     // a slight arc
          const f = 1 + 0.06 * Math.sin(T * 17) + 0.04 * Math.sin(T * 29);
          s.ms.forEach((m, k) => { m.position.copy(p); m.scale.setScalar(f); m.material.uniforms.uTime.value = T * (k ? 1.3 : 1); });
          // the trail: puffs shed behind it drifting up and back, and sparks
          const back = s.from.clone().sub(s.to).normalize().multiplyScalar(s.r * 3).add(V3(0, s.r * 4, 0));
          for (s.emit += dt * 70; s.emit >= 1; s.emit--) {
            puff(p.clone().add(rnd().multiplyScalar(s.r * 0.5)), back, s.r * (1.3 + Math.random()), 260 + Math.random() * 160, 0.95, s.look);
            if (Math.random() < 0.5) puff(p.clone(), rnd().multiplyScalar(s.r * 8), s.r * 0.6, 350, 1.1, s.look, 2);
          }
          if (q >= 1) { s.ms.forEach(drop); shots.splice(i, 1); this.burst(s.to, s.r, s.look); }
        }
        for (let i = puffs.length - 1; i >= 0; i--) {
          const f = puffs[i], age = (now - f.t0) / f.life;
          if (age >= 1) { drop(f.m); puffs.splice(i, 1); continue; }
          if (f.pull) f.m.position.lerp(f.pull, Math.min(1, dt * 7));            // drawn into the hand
          else { f.m.position.addScaledVector(f.v, dt); f.v.multiplyScalar(1 - dt * 2.2); }
          const u = f.m.material.uniforms; u.uTime.value = T; u.uAge.value = age;
          u.uK.value = f.heat * (f.shape === 2 ? Math.sin(Math.min(1, age * 1.3) * Math.PI) : 1 - age * age);
          u.uSize.value = f.size * (f.shape === 2 ? 1 : 1 + age * 1.3);
        }
      },
    };
  }
  return Object.freeze({ ball, system });
})();
