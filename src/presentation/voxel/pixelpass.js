/* EmberPixelPass — draws a three.js scene as a pixel sprite layer (docs/design/MINIATURES.md §1).
 * The scene is rendered at PIX × the canvas's CSS size into a render target with no antialiasing, then copied onto
 * the canvas (same size; the page scales it up with image-rendering: pixelated) through one shader that
 *   · draws one sprite pixel of ink around every solid silhouette (the sprite outline),
 *   · darkens the darker side of every strong colour boundary inside it (a pixel artist's selective inner outline),
 *   · quantises to a limited palette in display space,
 * and passes glow and particles (not solid) through untouched. The owner sizes the renderer: setPixelRatio(PIX) and
 * setSize(cssW, cssH, false) — the target follows the drawing buffer. */
const EmberPixelPass = (() => {
  const THREE = EmberVesperThree;
  const PIX = 0.5;                 // sprite pixels per CSS pixel
  const INK = [0x1c / 255, 0x14 / 255, 0x22 / 255];
  const FRAG = /* glsl */ `
    uniform sampler2D T; uniform vec2 S; uniform vec3 INK; uniform float Q;
    vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    vec4 at(vec2 p) { if (p.x < 0.0 || p.y < 0.0 || p.x >= S.x || p.y >= S.y) return vec4(0.0); return texture2D(T, (p + 0.5) / S); }
    float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main() {
      vec2 p = floor(gl_FragCoord.xy);
      vec4 c = at(p);
      vec2 N[4]; N[0] = vec2(1.0, 0.0); N[1] = vec2(-1.0, 0.0); N[2] = vec2(0.0, 1.0); N[3] = vec2(0.0, -1.0);
      if (c.a < 0.5) {
        for (int i = 0; i < 4; i++) if (at(p + N[i]).a >= 0.5) { gl_FragColor = vec4(INK, 1.0); return; }
        gl_FragColor = vec4(toSrgb(c.rgb), c.a);                         // glow, particles: as drawn
        return;
      }
      vec3 col = toSrgb(c.rgb); float L = lum(col);
      for (int i = 0; i < 4; i++) {
        vec4 n = at(p + N[i]); if (n.a < 0.5) continue;
        vec3 nc = toSrgb(n.rgb); float nl = lum(nc);
        if (length(nc - col) + abs(nl - L) > 0.32 && L < nl - 0.02) { col = mix(col * 0.42, INK, 0.35); break; }
      }
      gl_FragColor = vec4(floor(col * Q + 0.5) / Q, 1.0);
    }`;
  function create(renderer) {
    const target = new THREE.WebGLRenderTarget(1, 1, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true, generateMipmaps: false });
    const mat = new THREE.ShaderMaterial({
      uniforms: { T: { value: target.texture }, S: { value: new THREE.Vector2(1, 1) }, INK: { value: new THREE.Vector3(...INK) }, Q: { value: 18 } },
      vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
      fragmentShader: FRAG, depthTest: false, depthWrite: false, transparent: true, blending: THREE.NoBlending,
    });
    mat.toneMapped = false;
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
    const post = new THREE.Scene(); post.add(quad);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const size = new THREE.Vector2();
    function render(scene, camera) {
      renderer.getDrawingBufferSize(size);
      const w = Math.max(1, Math.round(size.x)), h = Math.max(1, Math.round(size.y));
      if (target.width !== w || target.height !== h) { target.setSize(w, h); mat.uniforms.S.value.set(w, h); }
      const clear = renderer.getClearAlpha();
      renderer.setRenderTarget(target); renderer.setClearAlpha(0); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.setClearAlpha(clear); renderer.clear(); renderer.render(post, cam);
    }
    function dispose() { target.dispose(); mat.dispose(); quad.geometry.dispose(); }
    return { render, dispose, target };
  }
  return Object.freeze({ create, PIX });
})();
