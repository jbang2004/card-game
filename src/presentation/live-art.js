/* Live artwork: the hero-select preview card, and the card presented on its own
 * (magnified detail, god stage, library stage) when that card has one. The
 * illustration itself is the model: three baked layers (background, figure, held prop), each
 * a depth-displaced mesh, are placed along the rest camera's sight lines, so the
 * portrait at rest is the card pixel for pixel. Idle motion (breathing, glances,
 * blinks, hair and cloth, the prop's own swing) is one smooth displacement field
 * per illustration from EmberLiveArtRigs. The card's tilt stays with
 * EmberCardRelief (mounted with `face: false`); the camera here follows those
 * same angles so the scene turns inside the tilted card, and the portrait lives
 * exactly as long as that mount. Presentation only: without WebGL2 or a baked
 * illustration, mount() resolves false and the caller keeps the relief face. */
const EmberLiveArt = (() => {
  const MAPS = EmberLiveArtMaps,
    RIGS = EmberLiveArtRigs;
  const IMG_W = 1086,
    IMG_H = 1448;
  const TAN_Y = Math.tan((11 * Math.PI) / 180),
    TAN_X = (TAN_Y * IMG_W) / IMG_H;
  // Scene depth and how far the camera turns per radian of card tilt.
  const DEPTH_SCALE = 0.5,
    PIVOT = 3 - DEPTH_SCALE / 2,
    FOLLOW = 0.35;
  const KINDS = ["bg", "body", "front", "depth", "ctrl", "flags"];
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const calm = () =>
    reducedQuery.matches || document.body.classList.contains("reduced-motion");

  const VERTEX = (rig) => `#version 300 es
precision highp float; precision highp int;
in vec2 aUv;
uniform sampler2D uDepth, uFlags;
uniform int uLayer;
uniform float uTime, uMotion;
uniform mat4 uView, uProj;
out vec2 vUv;
const vec2 IMG = vec2(${IMG_W}., ${IMG_H}.);
const float TAU = 6.2831853;
float FR;
float g2(vec2 p, vec2 c, vec2 r){ vec2 q = (p-c)/r; return exp(-dot(q, q)); }
vec2 rot(vec2 p, vec2 c, float a){ float s = sin(a), k = cos(a); p -= c; return vec2(k*p.x - s*p.y, s*p.x + k*p.y) + c; }
float segW(vec2 p, vec2 a, vec2 b, float r, out float along){ vec2 ab = b-a; float h = clamp(dot(p-a, ab)/dot(ab, ab), 0., 1.); along = h; return 1. - smoothstep(r*.45, r, length(p - a - ab*h)); }
float breath(float t){ float x = fract(t/4.8); return x < .42 ? smoothstep(0., .42, x) : 1. - smoothstep(.42, 1., x); }
vec2 disp(vec2 px, float t){ vec2 d = vec2(0.); float al;
${rig.disp}
  return d; }
vec2 bgDisp(vec2 px, float t){ vec2 d = vec2(0.); float al;
${rig.bgDisp || ""}
  return d; }
void main(){
  vUv = aUv;
  vec3 dep = texture(uDepth, aUv).rgb;
  FR = texture(uFlags, aUv).b;
  float z = uLayer == 0 ? dep.r : uLayer == 1 ? dep.g : dep.b;
  vec2 px = aUv*IMG;
  px += (uLayer == 0 ? bgDisp(px, uTime) : disp(px, uTime))*uMotion;
  vec2 uv = px/IMG;
  // On the rest camera's sight line through this pixel, at its own depth.
  float dist = 3. - z*${DEPTH_SCALE.toFixed(2)};
  gl_Position = uProj*uView*vec4(vec2(uv.x*2. - 1., 1. - uv.y*2.)*vec2(${TAN_X.toFixed(6)}, ${TAN_Y.toFixed(6)})*dist, -dist, 1.);
}`;

  const FRAGMENT = (rig) => `#version 300 es
precision highp float; precision highp int;
in vec2 vUv;
uniform sampler2D uTex, uCtrl;
uniform int uLayer;
uniform float uTime, uBlink, uGlint, uFx;
out vec4 o;
const vec2 IMG = vec2(${IMG_W}., ${IMG_H}.);
const float TAU = 6.2831853;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3. - 2.*f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
// Drifting points (snow, embers) moving with velocity vel in cells per second;
// density is the share of cells that hold one.
float particles(vec2 uv, float t, vec2 vel, float scale, float size, float density){
  vec2 p = uv*vec2(1., IMG.y/IMG.x)*scale - vel*t;
  vec2 i = floor(p), f = fract(p);
  float h = h21(i);
  vec2 o = .2 + .6*vec2(h21(i + 3.1), h21(i + 7.7)) + vec2(.12*sin(t*1.3 + h*6.28), 0.);
  return step(1. - density, h)*smoothstep(size, size*.3, length(f - o))*(.6 + .4*sin(t*3. + h*20.));
}
// Slanted rain streaks falling through the picture.
float rain(vec2 uv, float t){
  vec2 p = vec2(uv.x*90. + uv.y*18., uv.y*14. - t*9.);
  vec2 i = floor(p), f = fract(p);
  return step(.82, h21(i))*smoothstep(.12, 0., abs(f.x - .5))*smoothstep(0., .3, f.y)*smoothstep(1., .6, f.y);
}
vec2 toL(vec2 p, vec2 c, float a){ p -= c; float s = sin(-a), k = cos(-a); return vec2(k*p.x - s*p.y, s*p.x + k*p.y); }
vec2 toW(vec2 p, vec2 c, float a){ float s = sin(a), k = cos(a); return vec2(k*p.x - s*p.y, s*p.x + k*p.y) + c; }
// A blink: the lid closes as skin taken from just under the lower lid (stretching
// the lid upward would drag a close brow down); only the lash line travels.
vec3 blink(vec2 px, vec2 c, vec2 hs, float tilt, float k, inout vec2 skin){
  if (k <= 0.) return vec3(px, 0.);
  vec2 p = toL(px, c, tilt);
  float fx = 1. - pow(clamp(abs(p.x)/hs.x, 0., 1.), 2.);
  if (fx <= 0.) return vec3(px, 0.);
  float top = -hs.y*(.55 + .45*fx), bot = hs.y*(.45 + .55*fx);
  float kk = k*smoothstep(0., .35, fx);
  float la = 2.5, lb = 2., span = (bot - top - lb)*kk, line = top + span, y = p.y, w = 0.;
  if (y < top - 7. || y > bot + 1.) return vec3(px, 0.);
  if (y < line - la) w = smoothstep(top - 7., top - 2., y)*smoothstep(0., .12, kk)*smoothstep(0., .3, fx);
  else if (y <= line + lb) y -= span;
  else y = mix(top + lb, bot, (y - (line + lb))/max(bot - (line + lb), .001));
  skin = toW(vec2(p.x, bot + 5.), c, tilt);
  return vec3(toW(vec2(p.x, y), c, tilt), w);
}
void main(){
  vec2 uv = vUv, skinPx = vec2(0.);
  float shade = 0.;
  if (uLayer == 1) {
    vec3 bb = vec3(vUv*IMG, 0.);
${rig.eyes
  .map(
    (e) =>
      `    bb = blink(bb.xy, vec2(${e.c[0].toFixed(1)}, ${e.c[1].toFixed(1)}), vec2(${e.hs[0].toFixed(1)}, ${e.hs[1].toFixed(1)}), radians(${e.tilt.toFixed(1)}), uBlink, skinPx); shade = max(shade, bb.z);`,
  )
  .join("\n")}
    uv = bb.xy/IMG;
  }
  // Gradients of the unwarped coordinate: the blink's jumps must not pick a far mip.
  vec2 gx = dFdx(vUv), gy = dFdy(vUv);
  vec4 c = textureGrad(uTex, uv, gx, gy);
  if (shade > 0.) { vec4 sk = textureGrad(uTex, skinPx/IMG, gx, gy); c = mix(c, vec4(sk.rgb*.94, sk.a), shade); }
  if (uLayer != 0) c.rgb *= c.a;
  vec3 k = texture(uCtrl, vUv).rgb;
  float t = uTime; int layer = uLayer;
${rig.fx}
  o = uLayer == 0 ? vec4(c.rgb, 1.) : c;
}`;

  let canvas = null,
    gl = null,
    mesh = null,
    host = null,
    current = null,
    raf = 0,
    token = 0,
    last = 0,
    lastPaint = 0,
    clock = 0,
    frozen = null,
    visible = true,
    observer = null;
  const programs = new Map(),
    textures = new Map();
  const blinkState = { at: 1.6, double: false };
  const stats = { status: "idle", id: null, frames: 0, error: null, grid: 0, scale: 1 };

  function fail(error) {
    stats.status = "fallback";
    stats.error = String(error?.message || error);
    const owner = current;
    release();
    gl = null;
    programs.clear();
    textures.clear();
    console.warn("Hero live portrait unavailable; using the relief face.", stats.error);
    owner?.onFail?.();
  }
  function ensureContext() {
    if (gl) return true;
    if (stats.status === "fallback") return false;
    canvas = document.createElement("canvas");
    canvas.className = "live-art-canvas";
    canvas.setAttribute("aria-hidden", "true");
    gl = canvas.getContext("webgl2", { alpha: false, antialias: true, premultipliedAlpha: true });
    if (!gl) {
      stats.status = "fallback";
      stats.error = "WebGL2 unavailable";
      return false;
    }
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      fail("WebGL context lost");
    });
    return true;
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function program(id) {
    if (programs.has(id)) return programs.get(id);
    const rig = RIGS[id],
      handle = gl.createProgram();
    gl.attachShader(handle, compile(gl.VERTEX_SHADER, VERTEX(rig)));
    gl.attachShader(handle, compile(gl.FRAGMENT_SHADER, FRAGMENT(rig)));
    // Every rig reads the shared grid from attribute 0.
    gl.bindAttribLocation(handle, 0, "aUv");
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(handle));
    const u = {};
    for (const name of ["uDepth", "uFlags", "uLayer", "uTime", "uMotion", "uView", "uProj", "uTex", "uCtrl", "uBlink", "uGlint", "uFx"])
      u[name] = gl.getUniformLocation(handle, name);
    const entry = { handle, u };
    programs.set(id, entry);
    return entry;
  }
  /* One grid of texture coordinates serves every layer. Cells of about five
   * device pixels: the motion field is smooth and silhouettes come from the
   * layers' alpha, not the geometry, so a denser grid buys nothing. */
  function gridFor(width) {
    return Math.max(61, Math.min(181, Math.round(width / 5 / 20) * 20 + 1));
  }
  /* The grid reaches this far past each edge of the picture, sampled mirrored.
   * At rest the margin lies outside the frame; when the camera turns (at most
   * about 3% of the width at a full card tilt) it shows the picture continued
   * instead of the empty clear colour. */
  const MARGIN = 0.08;
  function ensureMesh(width) {
    const GX = gridFor(width);
    if (mesh?.grid === GX) return mesh;
    if (mesh) {
      gl.deleteVertexArray(mesh.vao);
      mesh.buffers.forEach((b) => gl.deleteBuffer(b));
    }
    const cells = Math.round((GX - 1) * (1 + 2 * MARGIN)),
      NX = cells + 1,
      NY = Math.round((cells * IMG_H) / IMG_W) + 1,
      uvs = new Float32Array(NX * NY * 2),
      index = new Uint32Array((NX - 1) * (NY - 1) * 6);
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        uvs[(j * NX + i) * 2] = -MARGIN + ((1 + 2 * MARGIN) * i) / (NX - 1);
        uvs[(j * NX + i) * 2 + 1] = -MARGIN + ((1 + 2 * MARGIN) * j) / (NY - 1);
      }
    let n = 0;
    for (let j = 0; j < NY - 1; j++)
      for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i;
        index.set([a, a + NX, a + 1, a + 1, a + NX, a + NX + 1], n);
        n += 6;
      }
    const vao = gl.createVertexArray(),
      buffers = [gl.createBuffer(), gl.createBuffer()];
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[0]);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers[1]);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    mesh = { vao, buffers, grid: GX, count: index.length };
    stats.grid = GX;
    return mesh;
  }
  /* `scale` < 1 uploads a reduced copy: a preview card only a few hundred device
   * pixels wide gains nothing from the 1086x1448 maps but a quarter of the memory. */
  async function texture(url, scale = 1) {
    const key = url + "@" + scale;
    if (textures.has(key)) return textures.get(key);
    const image = new Image();
    image.src = url;
    await image.decode();
    const source =
      scale < 1
        ? await createImageBitmap(image, {
            resizeWidth: Math.round(image.naturalWidth * scale),
            resizeHeight: Math.round(image.naturalHeight * scale),
            resizeQuality: "high",
            // keep colour under zero alpha: the filled areas are revealed by motion
            premultiplyAlpha: "none",
            colorSpaceConversion: "none",
          })
        : image;
    if (!gl) throw Error(stats.error || "context released");
    const handle = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    source.close?.();
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Mirrored: the grid's margin past the edges continues the picture (see MARGIN).
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    textures.set(key, handle);
    return handle;
  }
  // Only the hero on screen stays on the GPU.
  function trimTextures(keep) {
    for (const [key, handle] of textures)
      if (!keep.includes(key)) {
        gl.deleteTexture(handle);
        textures.delete(key);
      }
  }

  function release() {
    token++;
    cancelAnimationFrame(raf);
    raf = 0;
    observer?.disconnect();
    host?.classList.remove("live-art-ready");
    canvas?.remove();
    host = null;
    current = null;
    if (stats.status !== "fallback") stats.status = "idle";
  }

  const mat = {
    mul(a, b) {
      const o = new Float32Array(16);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
          let s = 0;
          for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
          o[c * 4 + r] = s;
        }
      return o;
    },
    rotX: (a) => new Float32Array([1, 0, 0, 0, 0, Math.cos(a), Math.sin(a), 0, 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 0, 1]),
    rotY: (a) => new Float32Array([Math.cos(a), 0, -Math.sin(a), 0, 0, 1, 0, 0, Math.sin(a), 0, Math.cos(a), 0, 0, 0, 0, 1]),
    move: (z) => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, z, 1]),
  };
  /* Perspective that shows the portrait like `background-size: cover` anchored at
   * `focus`, the same crop as the DOM artwork underneath. */
  function projection(aspect, focus) {
    const imageAspect = IMG_W / IMG_H;
    let fx, fy, ox = 0, oy = 0;
    if (aspect > imageAspect) {
      fx = 1 / TAN_X;
      fy = fx * aspect;
      const span = aspect / imageAspect;
      oy = (1 - span) * (1 - 2 * focus[1]);
    } else {
      fy = 1 / TAN_Y;
      fx = fy / aspect;
      const span = imageAspect / aspect;
      ox = (span - 1) * (1 - 2 * focus[0]);
    }
    const n = 0.1,
      f = 20;
    // Column-major; the third column shifts the crop in clip space.
    return new Float32Array([fx, 0, 0, 0, 0, fy, 0, 0, -ox, -oy, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]);
  }
  function blinkAmount(t) {
    const shape = (dt) =>
      dt < 0 ? 0 : dt < 0.075 ? dt / 0.075 : dt < 0.12 ? 1 : dt < 0.25 ? 1 - (dt - 0.12) / 0.13 : 0;
    const since = t - blinkState.at;
    let k = shape(since);
    if (blinkState.double) k = Math.max(k, shape(since - 0.32));
    if (since > (blinkState.double ? 0.6 : 0.3)) {
      blinkState.at = t + 2.8 + Math.random() * 3.4;
      blinkState.double = Math.random() < 0.22;
    }
    return k;
  }
  function paint() {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2),
      w = Math.round(width * dpr),
      h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      ensureMesh(w);
    }
    const still = calm(),
      t = frozen ? frozen.t : clock,
      turn = current.turn,
      view = mat.mul(
        mat.move(-PIVOT),
        mat.mul(mat.rotX(-turn.x * FOLLOW), mat.mul(mat.rotY(turn.y * FOLLOW), mat.move(PIVOT))),
      );
    const blink = frozen ? frozen.blink : still ? 0 : blinkAmount(t);
    const cycle = (t % 7.5) / 7.5,
      glint = cycle < 0.45 ? -0.7 + (cycle / 0.45) * 1.4 : 9;
    const { handle, u } = current.program;
    gl.viewport(0, 0, w, h);
    gl.clearColor(0.03, 0.035, 0.06, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(handle);
    gl.bindVertexArray(mesh.vao);
    gl.uniformMatrix4fv(u.uView, false, view);
    gl.uniformMatrix4fv(u.uProj, false, projection(w / h, current.focus));
    gl.uniform1f(u.uTime, still ? 0 : t);
    gl.uniform1f(u.uMotion, still ? 0 : 1);
    gl.uniform1f(u.uFx, still ? 0 : 1);
    gl.uniform1f(u.uBlink, blink);
    gl.uniform1f(u.uGlint, glint);
    const [bg, body, front, depth, ctrl, flags] = current.maps;
    [[depth, u.uDepth, 1], [ctrl, u.uCtrl, 2], [flags, u.uFlags, 3]].forEach(([map, loc, unit]) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, map);
      gl.uniform1i(loc, unit);
    });
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    [bg, body, front].forEach((map, layer) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, map);
      gl.uniform1i(u.uTex, 0);
      gl.uniform1i(u.uLayer, layer);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_INT, 0);
    });
    stats.frames++;
  }
  /* The idle motion is slow: 30 frames a second carry it, and so does the card's
   * own slow sway. While the player turns the card, every display frame is drawn
   * so the scene keeps pace with the CSS tilt of the card around it. */
  const IDLE_FRAME_MS = 1000 / 30 - 2,
    TURNING = 0.25; // rad/s
  function frame(now) {
    raf = 0;
    if (!host) return;
    // Gone from the page, or the card was put down (its tilt mount released).
    if (!host.isConnected || !EmberCardRelief.holds(host)) return release();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;
    const turn = EmberCardRelief.angles(),
      since = Math.max((now - lastPaint) / 1000, 1e-3),
      turning =
        (Math.abs(turn.x - current.turn.x) + Math.abs(turn.y - current.turn.y)) / since > TURNING;
    if (turning || now - lastPaint >= IDLE_FRAME_MS) {
      current.turn = turn;
      paint();
      lastPaint = now;
    }
    wake();
  }
  function wake() {
    // Reduced motion: the card is shown exactly as painted, and it does not turn
    // either (EmberCardRelief keeps it flat), so the frame from mount() stands.
    if (raf || !host || document.hidden || !visible || frozen || calm()) return;
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener("visibilitychange", () => {
    last = performance.now();
    wake();
  });

  /* Paint the live portrait `id` (a portraitId) into `element`.
   *   focus   [x, y] cover anchor, 0..1, matching the CSS background underneath
   *   onFail  called if the context is lost later; the caller restores its face */
  async function mount(element, { id, focus = [0.5, 0.22], onFail } = {}) {
    if (host) release();
    const mine = ++token;
    if (!element || !MAPS[id] || !RIGS[id] || !ensureContext()) return false;
    stats.status = "loading";
    try {
      const dpr = Math.min(devicePixelRatio || 1, 2),
        width = element.clientWidth * dpr;
      // The colour layers at half size once the card is no wider than that on screen.
      const scale = width && width <= IMG_W / 2 ? 0.5 : 1;
      const wanted = KINDS.map((kind) => [MAPS[id][kind], ["bg", "body", "front"].includes(kind) ? scale : 1]);
      const compiled = program(id);
      ensureMesh(width || IMG_W);
      const maps = await Promise.all(wanted.map(([url, s]) => texture(url, s)));
      if (mine !== token || !element.isConnected) return false;
      trimTextures(wanted.map(([url, s]) => url + "@" + s));
      host = element;
      current = { id, focus, maps, program: compiled, onFail, turn: EmberCardRelief.angles() };
      stats.id = id;
      stats.scale = scale;
      element.append(canvas);
      observer ??= new IntersectionObserver((entries) => {
        visible = entries.some((e) => e.isIntersecting);
        last = performance.now();
        wake();
      });
      observer.observe(element);
      last = lastPaint = performance.now();
      paint();
      element.classList.add("live-art-ready");
      stats.status = "ready";
      wake();
      return true;
    } catch (error) {
      if (mine === token) fail(error);
      return false;
    }
  }

  /* A rendered `.card` presented on its own: its `.card-art` shows the live
   * artwork when the card has one, cropped like the <img> underneath; otherwise
   * (or if WebGL gives out) the relief face as before. Options as for
   * EmberCardRelief.mountCard. */
  function mountCard(card, options) {
    const art = card?.querySelector(".card-art"),
      image = art?.querySelector("img");
    const face = () => card.isConnected && EmberCardRelief.mountCard(card, options);
    if (!image || !MAPS[options.id] || !RIGS[options.id]) return face();
    const [x = 50, y = 22] = getComputedStyle(image).objectPosition.split(" ").map(parseFloat);
    EmberCardRelief.mountCard(card, { ...options, face: false });
    return mount(art, { id: options.id, focus: [x / 100, y / 100], onFail: face }).then(
      (ok) => ok || face(),
    );
  }

  return Object.freeze({
    mount,
    mountCard,
    release,
    has: (id) => !!(MAPS[id] && RIGS[id]),
    diagnostics: () => ({ ...stats }),
    /* Review hook: hold the idle clock at `t` seconds with a blink amount 0..1, or
     * resume with no arguments. */
    pose(t, blink = 0) {
      frozen = t == null ? null : { t, blink };
      if (host && frozen) {
        current.turn = EmberCardRelief.angles();
        paint();
      }
      else {
        last = performance.now();
        wake();
      }
    },
  });
})();
