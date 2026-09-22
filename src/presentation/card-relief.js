/* Relief-mapped card face. The DOM card keeps its frame, text, badges and layout
 * and is tilted by CSS 3D; this module only paints the illustration into a child
 * canvas, lit for that same tilt. One canvas serves whichever single card is
 * being presented: the hero-select preview, the card lifted out of the hand, or
 * the magnified detail card. Presentation-only: a missing WebGL2 context, map or
 * decode simply leaves the existing flat artwork. */
const EmberCardRelief = (() => {
  const MAPS = EmberCardReliefMaps;
  const STUDIO = "asset:relief/studio.webp";
  const IMAGE_ASPECT = 768 / 1024;
  // Relief depth in image heights. A card's art is a small cropped window, so it
  // needs a deeper field than the full portrait to read as layered.
  const DEPTH = { portrait: 0.06, card: 0.095 };
  // Material by rarity. Every card has depth and a lacquered face — the glare is
  // what makes it a physical card in the hand; reflective metal and iridescent
  // foil are earned. [coat, metal, foil]
  const FINISH = {
    common: [1, 0, 0],
    rare: [1, 0.5, 0],
    epic: [1, 1, 0],
    legendary: [1, 1, 1],
  };
  // The tilt is a damped spring (rate in rad/s, damping ratio): a little overshoot
  // is what gives the card weight in the hand.
  const STEER = {
    // Face the pointer; sway after a pause so the relief stays readable.
    pointer: { range: [0.3, 0.2], spring: [9, 0.8], idleAfter: 2500, sway: [0.6, 0.35] },
    // A card held up to read: faces the pointer, and sways soon after it rests so
    // a finger that cannot hover still sees the depth.
    held: { range: [0.34, 0.24], spring: [10, 0.7], idleAfter: 900, sway: [0.55, 0.32] },
    // Lean into the motion of the hand carrying the card, swing back when it stops.
    drag: { range: [0.42, 0.32], spring: [13, 0.5], idleAfter: 500, sway: [0.3, 0.2] },
  };
  // `follow` is for a card whose owner already tilts it (the god stage, ±6°): the
  // face is lit for a somewhat wider virtual turn than the DOM makes, and never
  // sways on its own, because the card itself would not be moving.
  STEER.follow = { range: [0.24, 0.24], spring: [10, 0.7], idleAfter: Infinity, sway: [0, 0] };
  const SWAY_SPRING = [5, 1];
  // A card is a slab, not a sticker. Its thickness is real geometry: a stack of
  // card-shaped layers straight behind the face along Z, so the browser's own
  // perspective produces the side faces and the way the back recedes — and, like a
  // real card, shows them only on the edges turned toward the viewer, only by
  // depth × sin(angle). A held card leans a few degrees and shows a sliver; the
  // thickness is read when a card turns over on a stage. Thick card stock, not a
  // tile: about 12px on a hand card, 17px on a stage card.
  const THICKNESS = 0.05,
    MAX_LAYERS = 28;
  // The face's painted edge (card-face.css `.card-inner`: a max(1px, 0.5cqw)
  // hairline seated on a 1px dark line) lies outside the card box, in its plane.
  const EDGE = (width) => Math.max(1, width * 0.005);
  const SWAY_FRAME_MS = 1000 / 30;
  // The sway makes its point in a few breaths; after that a card left alone comes to
  // rest and costs nothing until the pointer moves again.
  const SWAY_FOR_MS = 12000;
  const VERTEX = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
  // Card space: x right, y up, z toward the viewer. uRotation maps card space to
  // the fixed world of the lights; the face itself is flat, so card space is
  // also tangent space for the relief march and the normal map.
  const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uColor,uHeight,uNormal,uOrm,uStudio;
uniform mat3 uRotation;
uniform vec4 uCrop;
uniform vec2 uSize;
uniform float uDepth,uDerive;
uniform vec3 uFinish;
uniform vec2 uTexel;
const vec3 EYE=vec3(0.,0.,2.6);
vec2 gradX,gradY;
float surfaceAt(vec2 uv){return 1.-textureGrad(uHeight,uv,gradX,gradY).r;}
vec2 marchRelief(vec2 uv,vec3 eye){
  float edge=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));
  vec2 ray=eye.xy/max(eye.z,.5)*uDepth*smoothstep(0.,.08,edge);
  ray.x*=${(1 / IMAGE_ASPECT).toFixed(5)};
  float steps=mix(12.,28.,smoothstep(.05,.45,length(eye.xy)));
  vec2 delta=ray/steps,at=uv+ray*.5;
  float layer=0.,surface=surfaceAt(at);
  for(int i=0;i<28;i++){
    if(layer>=surface)break;
    at-=delta;layer+=1./steps;surface=surfaceAt(at);
  }
  float after=surface-layer,before=surfaceAt(at+delta)-layer+1./steps;
  return clamp(mix(at,at+delta,clamp(after/(after-before-1e-5),0.,1.)),.001,.999);
}
// Pre-baked studio (tools/bake_relief_studio.py): six stereographic tiles, sharp to
// fully rough, HDR stored as sqrt(radiance / 6).
vec3 studioTile(vec2 p,float tile){
  vec3 v=textureLod(uStudio,vec2((tile+clamp(p.x,.004,.996))/6.,p.y),0.).rgb;
  return v*v*6.;
}
vec3 studio(vec3 dir,float roughness){
  dir=normalize(vec3(dir.xy,max(dir.z,.001)));
  vec2 p=dir.xy/(1.+dir.z)/2.2+.5;
  float level=clamp(roughness,0.,1.)*5.,tile=min(floor(level),4.);
  return mix(studioTile(p,tile),studioTile(p,tile+1.),level-tile);
}
vec3 fresnel(vec3 f0,float cosine){return f0+(1.-f0)*pow(1.-cosine,5.);}
void main(){
  vec2 uv=vUv*uCrop.xy+uCrop.zw;
  gradX=dFdx(uv);gradY=dFdy(uv);
  vec3 eyeWorld=normalize(EYE-uRotation*vec3((vUv-.5)*uSize,0.));
  vec3 eye=eyeWorld*uRotation;
  vec2 at=marchRelief(uv,eye);
  vec3 albedo=pow(textureGrad(uColor,at,gradX,gradY).rgb,vec3(2.2));
  vec3 orm=textureGrad(uOrm,at,gradX,gradY).rgb;
  vec3 normal;
  if(uDerive>.5){
    // Small cards ship no normal map; the height field's own slope is enough at that size.
    vec2 slope=vec2(surfaceAt(at+vec2(uTexel.x,0.))-surfaceAt(at-vec2(uTexel.x,0.)),surfaceAt(at+vec2(0.,uTexel.y))-surfaceAt(at-vec2(0.,uTexel.y)));
    normal=normalize(vec3(clamp(slope*5.,-1.,1.),1.));
  }else{
    vec3 mapped=textureGrad(uNormal,at,gradX,gradY).xyz*2.-1.;
    normal=normalize(vec3(mapped.xy*.9,mapped.z));
  }
  float foil=orm.r*uFinish.z,roughness=mix(.92,orm.g,uFinish.y),metal=orm.b*uFinish.y;
  float facing=max(dot(normal,eye),.001);

  // The illustration already carries its painted light, so the diffuse term only
  // leans on the key light. Metal gives up most of its diffuse and earns it back
  // from the studio's ceiling bounce, so head-on the face matches the portrait.
  vec3 keyLight=normalize(vec3(-.45,.6,.66))*uRotation;
  float lambert=max(dot(normal,keyLight),0.);
  vec3 color=albedo*(1.-metal*.75)*(.80+.30*lambert);

  // Thin-film tint on the foil mask shifts hue with viewing angle.
  vec3 film=.5+.5*cos(6.2832*(facing*vec3(1.,1.18,1.42)*1.35+vec3(0.,.33,.67)));
  vec3 f0=mix(vec3(.04),albedo,metal*.85);
  f0=mix(f0,f0*film*1.7,foil*.3);
  vec3 reflected=uRotation*reflect(-eye,normal);
  // Matte paint must not pick up the softboxes as a wash; only polished areas reflect.
  float polish=1.-roughness;
  color+=studio(reflected,roughness*.8)*fresnel(f0,facing)*(polish*polish*1.8+.015);

  // Smooth lacquer over the print, lit by a strip light on each side. The lacquer is
  // flat (paint grain would turn the glare to dust) and its lights sit close, so the
  // glare is a narrow diagonal bar that crosses the face, never a full-face wash.
  vec3 coatEye=normalize(vec3(0.,0.,1.3)-uRotation*vec3((vUv-.5)*uSize,0.))*uRotation;
  float sweep=dot(uRotation*reflect(-coatEye,vec3(0.,0.,1.)),normalize(vec3(.9,.45,0.)));
  // x*x, not pow(x,2.): pow of a negative base is undefined in GLSL and drops the bar.
  float cool=(sweep+.5)/.03,warm=(sweep-.56)/.028;
  vec3 strips=vec3(.95,.98,1.)*exp(-cool*cool)*1.7+vec3(1.,.86,.68)*exp(-warm*warm)*1.2;
  color=color*(1.-.036*uFinish.x)+strips*fresnel(vec3(.04),max(coatEye.z,.001))*2.*uFinish.x;

  color=mix(color,.78+.22*(1.-exp(-(color-.78)*4.5)),step(.78,color));
  outColor=vec4(pow(clamp(color,0.,1.),vec3(1./2.2)),1.);
}`;

  const stats = { status: "idle", frames: 0, error: null, id: null, steer: null, asleep: true };
  const textures = new Map();
  // A full hand is ten cards of three maps each, plus what is being shown.
  const TEXTURE_BUDGET = 40;
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const calm = () =>
    reducedQuery.matches || document.body.classList.contains("reduced-motion");
  let canvas,
    gl,
    uniforms,
    host = null,
    current = null,
    raf = 0,
    last = 0,
    token = 0,
    lastPointer = -1e9,
    lastMove = null,
    frozen = false,
    reviewDepth = null,
    warned = false,
    dirty = false,
    lastPaint = 0,
    idleTimer = 0,
    resizeWatch = null,
    pointerAt = { x: NaN, y: NaN };
  const tilt = { x: 0, y: 0 },
    velocity = { x: 0, y: 0 },
    target = { x: 0, y: 0 };

  function fail(error) {
    stats.status = "fallback";
    stats.error = String(error?.message || error);
    cancelAnimationFrame(raf);
    raf = 0;
    release();
    textures.clear();
    gl = null;
    // One diagnostic; the DOM portrait underneath stays as the presentation.
    console.warn("Card relief unavailable; using the flat portrait.", stats.error);
  }
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(shader));
    return shader;
  }
  function ensureContext() {
    if (gl || stats.status === "fallback") return !!gl;
    canvas = document.createElement("canvas");
    canvas.className = "card-relief-canvas";
    canvas.setAttribute("aria-hidden", "true");
    const context = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!context) {
      fail("WebGL2 unavailable");
      return false;
    }
    gl = context;
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      fail("WebGL context lost");
    });
    try {
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(program, "aPosition");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = {};
      for (const name of ["uRotation", "uCrop", "uSize", "uDepth", "uDerive", "uFinish", "uTexel"])
        uniforms[name] = gl.getUniformLocation(program, name);
      ["uColor", "uHeight", "uNormal", "uOrm", "uStudio"].forEach((name, unit) =>
        gl.uniform1i(gl.getUniformLocation(program, name), unit),
      );
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    } catch (error) {
      fail(error);
      return false;
    }
    return true;
  }
  /* `source` is a URL, or the <img> already showing that artwork: reusing the
   * element avoids decoding the same illustration a second time. */
  async function texture(source) {
    const url = typeof source === "string" ? source : source.currentSrc || source.src;
    if (textures.has(url)) {
      // Refresh recency: the map's insertion order is the eviction order.
      const kept = textures.get(url);
      textures.delete(url);
      textures.set(url, kept);
      return kept;
    }
    let image = source;
    if (typeof source === "string") {
      image = new Image();
      image.src = url;
    }
    await image.decode();
    if (!gl) throw Error(stats.error || "context released");
    if (textures.has(url)) return textures.get(url);
    const handle = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const entry = { handle, width: image.naturalWidth, height: image.naturalHeight };
    textures.set(url, entry);
    return entry;
  }
  // A match walks through dozens of illustrations; keep only the recent ones on the GPU.
  function trimTextures() {
    for (const [url, entry] of textures) {
      if (textures.size <= TEXTURE_BUDGET) break;
      if (current?.maps.includes(entry)) continue;
      gl.deleteTexture(entry.handle);
      textures.delete(url);
    }
  }

  function release() {
    token++;
    cancelAnimationFrame(raf);
    raf = 0;
    clearTimeout(idleTimer);
    resizeWatch?.disconnect();
    stats.asleep = true;
    if (current?.tiltTarget) {
      current.tiltTarget.classList.remove("card-relief-tilt", "card-relief-hinge");
      slab(current.tiltTarget, false);
      current.tiltTarget.style.removeProperty("--relief-rx");
      current.tiltTarget.style.removeProperty("--relief-ry");
    }
    host?.classList.remove("card-relief-ready");
    canvas?.remove();
    host = null;
    current = null;
    lastMove = null;
    if (stats.status !== "fallback") stats.status = "idle";
    tilt.x = tilt.y = velocity.x = velocity.y = target.x = target.y = 0;
    removeEventListener("pointermove", steer);
  }
  function steer(event) {
    pointerAt = { x: event.clientX, y: event.clientY };
    if (!current) return;
    // The stage it follows does not tilt for a finger, so neither does the face.
    if (current.steer === STEER.follow && event.pointerType === "touch") return;
    const now = performance.now();
    if (current.steer === STEER.drag) {
      if (lastMove && now > lastMove.t) {
        // About 1.2 px/ms of hand speed is a full lean.
        const dt = Math.max(now - lastMove.t, 4);
        target.x = Math.max(-1, Math.min(1, (event.clientX - lastMove.x) / dt / 1.2));
        target.y = Math.max(-1, Math.min(1, (event.clientY - lastMove.y) / dt / 1.2));
      }
      lastMove = { x: event.clientX, y: event.clientY, t: now };
    } else {
      const anchor = current.anchor?.isConnected ? current.anchor : host;
      const box = anchor.getBoundingClientRect();
      // Against the card itself, its own edges are the full turn on each axis; the
      // hero preview is steered from anywhere in the window instead.
      const wide = anchor === host ? Math.max(box.width * 1.6, innerWidth * 0.3) : 0,
        reachX = wide || box.width / 2,
        reachY = wide || box.height / 2;
      target.x = Math.max(-1, Math.min(1, (event.clientX - box.left - box.width / 2) / reachX));
      target.y = Math.max(-1, Math.min(1, (event.clientY - box.top - box.height / 2) / reachY));
    }
    lastPointer = now;
    wake();
  }
  /* Give `card` (a `.card` element inside a 3D-tilted parent, or tilted itself) its
   * thickness, or take it away. Returns { depth, flange } in px (null when off) so an
   * owner with a card back can seat it that far behind the face. The layers sit under
   * the card's own children and the rim over them; a flat clone of the markup is
   * unaffected once they are removed. Owners that turn a card over (the stages) keep
   * the slab through the flip — that is where it is seen. */
  function slab(card, on = true) {
    if (!card?.classList.contains("card")) return null;
    card
      .querySelectorAll(":scope > .card-relief-slab, :scope > .card-relief-rim")
      .forEach((node) => node.remove());
    card.classList.toggle("card-relief-slabbed", on);
    ["--relief-depth", "--relief-flange", "--relief-rim"].forEach((p) =>
      card.style.removeProperty(p),
    );
    if (!on) return null;
    const width = card.offsetWidth,
      depth = Math.max(4, Math.round(width * THICKNESS)),
      // The slab is as wide as the face with its painted edge: an edge overhanging
      // the side would cover it at every gentle angle.
      flange = EDGE(width) + 1,
      count = Math.min(MAX_LAYERS, depth);
    card.style.setProperty("--relief-depth", depth + "px");
    card.style.setProperty("--relief-flange", flange.toFixed(2) + "px");
    const layers = document.createDocumentFragment();
    for (let k = 1; k <= count; k++) {
      const layer = document.createElement("i");
      layer.className = "card-relief-slab";
      layer.setAttribute("aria-hidden", "true");
      // Board lit by the key light right behind the face's dark line, falling off
      // toward the back. Only a layer's rim is ever seen, so a diagonal ramp per layer
      // makes the sides facing the upper-left light paler than the sides facing away.
      const at = k / count,
        lit = 0.9 - 0.5 * at,
        tone = (level) =>
          "rgb(" + [226, 231, 238].map((c) => Math.round(c * level + 12 * (1 - level))).join(",") + ")";
      layer.style.background = `linear-gradient(135deg, ${tone(lit)} 0%, ${tone(lit * 0.72)} 50%, ${tone(lit * 0.36)} 100%)`;
      if (k === count) layer.dataset.last = "";
      layer.style.setProperty("--z", (-depth * at).toFixed(2) + "px");
      layers.append(layer);
    }
    card.prepend(layers);
    // The bevel where the face meets the side; paint() lights it by the tilt.
    const rim = document.createElement("i");
    rim.className = "card-relief-rim";
    rim.setAttribute("aria-hidden", "true");
    card.append(rim);
    return { depth, flange };
  }
  /* The face's bevel catches the key light (upper left) on the edges turned toward
   * the viewer and falls dark on the edges turned away, like the sides do. */
  function lightRim(face) {
    if (!face?.classList.contains("card-relief-slabbed")) return;
    // CSS rotateY(+) brings the left edge forward, rotateX(+) the bottom; paint()
    // writes --relief-ry = ry and --relief-rx = -rx.
    const near = { left: tilt.x, right: -tilt.x, top: tilt.y, bottom: -tilt.y },
      lit = { left: 0.45, top: 0.45, right: -0.45, bottom: -0.45 },
      w = (parseFloat(face.style.getPropertyValue("--relief-flange")) - 1).toFixed(2) + "px",
      color = (side) => {
        const i = Math.max(-1, Math.min(1, lit[side] + 0.5 * near[side]));
        return i >= 0 ? `rgba(255,255,255,${(i * 0.55).toFixed(3)})` : `rgba(0,0,0,${(-i * 0.7).toFixed(3)})`;
      };
    face.style.setProperty(
      "--relief-rim",
      `inset 0 ${w} 0 0 ${color("top")}, inset 0 -${w} 0 0 ${color("bottom")}, inset ${w} 0 0 0 ${color("left")}, inset -${w} 0 0 0 ${color("right")}`,
    );
  }
  function wake() {
    clearTimeout(idleTimer);
    if (raf || !host || frozen) return;
    // Coming out of sleep, the clock restarts so the spring does not see a long step.
    if (stats.asleep) last = performance.now();
    stats.asleep = false;
    raf = requestAnimationFrame(frame);
  }
  function paint() {
    const width = host.clientWidth,
      height = host.clientHeight;
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(width * dpr),
      h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    const ry = tilt.x * current.steer.range[0],
      rx = tilt.y * current.steer.range[1];
    // Same order as the CSS transform: rotateX rotateY. CSS y points down, so
    // its rotateX angle is the negative of the rotation about this space's +x.
    const cy = Math.cos(ry),
      sy = Math.sin(ry),
      cx = Math.cos(rx),
      sx = Math.sin(rx);
    // A hinged card (see `hinge`) turns about its bottom edge, which only stays put if
    // the X turn is applied first: CSS `rotateY rotateX`, so R = Ry * Rx.
    gl.uniformMatrix3fv(
      uniforms.uRotation,
      false,
      current.hinge
        ? [cy, 0, -sy, sy * sx, cx, cy * sx, sy * cx, -sx, cy * cx]
        : [cy, sx * sy, -cx * sy, 0, cx, sx, sy, -sx * cy, cx * cy],
    );
    // object-fit / background-size: cover, anchored like the DOM artwork underneath.
    const aspect = width / height;
    const sx2 = Math.min(1, aspect / IMAGE_ASPECT),
      sy2 = Math.min(1, IMAGE_ASPECT / aspect);
    gl.uniform4f(
      uniforms.uCrop,
      sx2,
      sy2,
      (1 - sx2) * current.focus[0],
      (1 - sy2) * (1 - current.focus[1]),
    );
    gl.uniform2f(uniforms.uSize, aspect, 1);
    gl.uniform1f(uniforms.uDepth, reviewDepth ?? current.depth);
    gl.uniform1f(uniforms.uDerive, current.derive ? 1 : 0);
    gl.uniform3fv(uniforms.uFinish, current.finish);
    // Slope is sampled a material texel apart: wide enough to stay smooth on a full-size height map.
    gl.uniform2f(uniforms.uTexel, 1 / current.maps[3].width, 1 / current.maps[3].height);
    current.maps.forEach((entry, unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, entry.handle);
    });
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    current.tiltTarget?.style.setProperty("--relief-rx", (-rx * 180) / Math.PI + "deg");
    current.tiltTarget?.style.setProperty("--relief-ry", (ry * 180) / Math.PI + "deg");
    // A card an owner tilts itself (the stages) still has its slab and rim.
    lightRim(current.tiltTarget || host.closest(".card"));
    stats.frames++;
  }
  function spring(axis, goal, [rate, damping], dt) {
    // Semi-implicit Euler in short sub-steps stays stable through a dropped frame.
    for (let left = dt; left > 1e-5; left -= 1 / 120) {
      const step = Math.min(left, 1 / 120);
      velocity[axis] += (rate * rate * (goal - tilt[axis]) - 2 * damping * rate * velocity[axis]) * step;
      tilt[axis] += velocity[axis] * step;
    }
  }
  function frame(now) {
    raf = 0;
    if (!host) return;
    if (!host.isConnected) return release();
    if (document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const still = calm(),
      mode = current.steer,
      quiet = now - lastPointer;
    // A carried card stops leaning as soon as the hand stops.
    if (mode === STEER.drag && quiet > 70) target.x = target.y = 0;
    // With nobody steering, a slow sway keeps the relief readable.
    const idle = !still && quiet > mode.idleAfter && quiet < mode.idleAfter + SWAY_FOR_MS;
    if (quiet >= mode.idleAfter + SWAY_FOR_MS) target.x = target.y = 0;
    const tx = still ? 0 : idle ? Math.sin(now * 0.0007) * mode.sway[0] : target.x,
      ty = still ? 0 : idle ? Math.cos(now * 0.00053) * mode.sway[1] : target.y;
    spring("x", tx, idle ? SWAY_SPRING : mode.spring, dt);
    spring("y", ty, idle ? SWAY_SPRING : mode.spring, dt);
    const moving =
      Math.abs(tx - tilt.x) + Math.abs(ty - tilt.y) > 0.0015 ||
      Math.abs(velocity.x) + Math.abs(velocity.y) > 0.004;
    // The slow sway does not need every display frame.
    if (dirty || (moving && !(idle && now - lastPaint < SWAY_FRAME_MS - 2))) {
      paint();
      dirty = false;
      lastPaint = now;
    }
    if (moving || idle) return wake();
    // At rest the picture cannot change: stop drawing until the pointer moves, the
    // box resizes, or it is time to start swaying.
    stats.asleep = true;
    if (!still && quiet < mode.idleAfter && isFinite(mode.idleAfter))
      idleTimer = setTimeout(wake, mode.idleAfter - quiet);
  }

  /* Paint `element` (an artwork box) with the relief face of illustration `id`.
   *   color       the illustration's URL, as already shown underneath
   *   focus       [x, y] cover anchor, 0..1, matching the CSS position underneath
   *   tiltTarget  element that receives the 3D tilt (default: `element`)
   *   steer       "pointer" (face the pointer) or "drag" (lean into hand motion)
   *   anchor      for "pointer": the element the pointer is measured against
   *   rarity      material tier; omitted means the full finish
   *   tilt        false when the owner already tilts the element itself
   *   hinge       turn about the bottom edge, which then never moves */
  async function mount(element, options) {
    const { id, color, focus = [0.5, 0.22], rarity } = options;
    // Re-mounting the same kind of view (switching hero) keeps the pose it had.
    const carried = current && (options.steer || "pointer") !== "drag" ? { ...tilt } : null;
    if (host) release();
    if (carried) Object.assign(tilt, carried);
    const mine = ++token;
    if (!element || !MAPS[id] || !ensureContext()) return false;
    stats.status = "loading";
    try {
      const set = MAPS[id];
      const maps = await Promise.all(
        [color, set.height, set.normal || set.height, set.orm, STUDIO].map(texture),
      );
      if (mine !== token || !element.isConnected) return false;
      host = element;
      current = {
        id,
        maps,
        focus,
        derive: !set.normal,
        depth: set.normal ? DEPTH.portrait : DEPTH.card,
        hinge: !!options.hinge,
        finish: FINISH[rarity] || FINISH.legendary,
        steer: STEER[options.steer] || STEER.pointer,
        anchor: options.anchor || null,
        tiltTarget: options.tilt === false ? null : options.tiltTarget || element,
      };
      stats.id = id;
      stats.steer = options.steer || "pointer";
      trimTextures();
      // After the artwork it replaces (a card's <img> is positioned, so document order
      // decides), still before the element's ::after gradient.
      element.append(canvas);
      addEventListener("pointermove", steer, { passive: true });
      last = performance.now();
      // The preview sways from the start; a card just picked up first answers the hand.
      lastPointer = current.steer === STEER.pointer ? last - current.steer.idleAfter : last;
      resizeWatch ??= new ResizeObserver(() => {
        dirty = true;
        wake();
      });
      resizeWatch.observe(element);
      paint();
      lastPaint = last;
      element.classList.add("card-relief-ready");
      current.tiltTarget?.classList.add("card-relief-tilt");
      current.tiltTarget?.classList.toggle("card-relief-hinge", current.hinge);
      slab(current.tiltTarget);
      stats.status = "ready";
      wake();
      return true;
    } catch (error) {
      // A single undecodable map is not a reason to give up on every other card.
      if (mine === token && gl && !warned) {
        warned = true;
        console.warn("Card relief skipped for " + id + ".", String(error?.message || error));
      }
      return false;
    }
  }
  /* Convenience for a rendered `.card`: paints its `.card-art`, tilts the card. */
  function mountCard(card, options) {
    const art = card?.querySelector(".card-art"),
      image = art?.querySelector("img");
    if (!image) return Promise.resolve(false);
    const [x = 50, y = 22] = getComputedStyle(image)
      .objectPosition.split(" ")
      .map(parseFloat);
    return mount(art, {
      ...options,
      color: image,
      focus: [x / 100, y / 100],
      tiltTarget: card,
      tilt: options.tilt,
      hinge: options.hinge,
      // Measured against the whole card, so crossing it sweeps the full tilt range.
      anchor: options.anchor || card,
    });
  }
  /* A row of cards offered side by side (opening hand, discover): only the one the
   * player is attending to is in relief, and it stays so until they attend another.
   * `describe(element)` returns that choice's { id, rarity }. */
  function attend(choices, describe, initial = null) {
    const show = (choice) => {
      const card = choice.querySelector(".card");
      if (!card || current?.tiltTarget === card) return;
      // A row card has a label right under it, so it turns about its bottom edge.
      mountCard(card, { ...describe(choice), steer: "held", hinge: true });
    };
    for (const choice of choices) {
      choice.addEventListener(
        "pointerenter",
        (event) => {
          // Redrawing the row slides cards under a resting pointer, and the browser
          // reports that as an enter. Only a pointer that actually moved attends.
          const moved = event.clientX !== pointerAt.x || event.clientY !== pointerAt.y;
          pointerAt = { x: event.clientX, y: event.clientY };
          if (moved || !initial) show(choice);
        },
        { passive: true },
      );
      choice.addEventListener("pointerdown", () => show(choice), { passive: true });
      // Keyboard focus attends; the dialog parking focus on its first button does not.
      choice.addEventListener("focus", () => {
        if (choice.matches(":focus-visible")) show(choice);
      });
    }
    if (initial) show(initial);
  }
  /* Get ready for cards the player may pick up next: build the GPU program before
   * the first lift and upload the maps while nothing else is happening.
   * `cards` is a list of { id, image } with the <img> currently showing the art. */
  let warmed = false;
  function warm(cards) {
    if (calm() || stats.status === "fallback") return;
    const wanted = cards.filter(
      ({ id, image }) =>
        MAPS[id] && image && !textures.has(image.currentSrc || image.src),
    );
    if (warmed && !wanted.length) return;
    (window.requestIdleCallback || setTimeout)(async () => {
      if (!ensureContext()) return;
      if (!warmed) {
        warmed = true;
        // Drivers build the real pipeline on first use; spend that on one hidden pixel
        // (unless a card is already up, which means the pipeline exists).
        if (!host) {
          gl.viewport(0, 0, 1, 1);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        texture(STUDIO).catch(() => {});
      }
      for (const { id, image } of wanted) {
        if (!image.isConnected) continue;
        const set = MAPS[id];
        // A map that fails here simply fails again, and is reported, when mounted.
        await Promise.all([image, set.height, set.orm].map(texture)).catch(() => {});
      }
      if (gl) trimTextures();
    });
  }
  document.addEventListener("visibilitychange", wake);

  return Object.freeze({
    mount,
    mountCard,
    attend,
    slab,
    warm,
    release,
    /* The pointer left the surface that steers the card: come back to face-on. */
    rest() {
      target.x = target.y = 0;
      wake();
    },
    has: (id) => !!MAPS[id],
    diagnostics: () => ({ ...stats }),
    /* Review hook: hold a fixed tilt (-1..1 on each axis) for A/B frames, optionally
     * with an overriding relief depth (0 isolates lighting from parallax). */
    pose(x, y, depth = null) {
      frozen = x != null;
      reviewDepth = frozen ? depth : null;
      if (frozen && host) {
        cancelAnimationFrame(raf);
        raf = 0;
        tilt.x = x;
        tilt.y = y;
        velocity.x = velocity.y = 0;
        paint();
      } else wake();
    },
  });
})();
