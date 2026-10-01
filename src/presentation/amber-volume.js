/* The amber card: one card sealed in a block of resin, drawn with WebGL2.
 *
 * The painted frame (art/ui/amber-card-v2/body.png) is the block's front face at z = 0. The card's layers (scene, figure,
 * optional held prop, each a depth-displaced mesh) sit BEHIND it along the rest sight lines, so at rest the card shows its
 * illustration exactly and a turn gives true window parallax. Every interior fragment is cast back along the view ray to the
 * front plane: that point decides whether it is seen through the face (silhouette mask) and how much resin the ray crossed
 * (Beer-Lambert absorption). Resin veils and bubble sprites add depth, the wedge-shaped wall of the block refracts the same
 * sealed layers, and highlights are computed from the tilt. The card's name, rules, cost and numbers are drawn on its face
 * (the DOM card keeps the same text for reading and for tests); a rarity recolours the apex stone and the nameplate metal, a
 * class recolours the frame and the resin.
 *
 * `EmberAmberVolume.create(canvas, { live })` returns a renderer for one canvas:
 *   still(id, over, cardPx)   -> a canvas holding the card face-on, cropped to the card's box (for the cards in lists and hands)
 *   show(id, over, cardPx)    -> make the card live in the canvas (see `aim`, `start`, `stop`)
 *   aim(px, py)               -> where the pointer is on the card, -0.5 .. 0.5 on each axis
 * Layers come from EmberAmberLayers (art/amber, tools/bake_amber_layers.py); a card without them (the single-file build)
 * seals its flat illustration instead. Presentation only: no WebGL2 means create() resolves null and the DOM card stays. */
const EmberAmberVolume = (() => {
  "use strict";
  async function create(canvas, { live = false, keep = 36, sway = false } = {}) {
  const W = 1, H = 1.48;                       // card units: width 1, height 1.48
  const MW = 512, MH = Math.round(MW * H);      // data-map resolution
  /* ---------------------------------------------------------------- parameters */
  const P = { gam: 1, paused: true, arch: true, zoom: 0.9, classTint: true, T: 0.34, wedge: 0.8, sidedeep: 1.6, eco: true, relief: 1, amber: 1, bubbles: 1, gloss: 1, range: 1, flat: false, follow: 0.85, ui: true, showBg: true, showBody: true, sway };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  /* ----------------------------------------------------------------- GL setup */
  const SKIP = new Set();
  let dirty = true;
  const invalidate = () => { dirty = true; };
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true });
  if (!gl) return null;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let CW = 560 * dpr, CH = 800 * dpr;          // the canvas in device pixels: the card is 85% of its width
  let qscale = 1;                              // adaptive resolution, 0.55 .. 1
  function sizeCanvas() { const w = Math.round(CW * qscale), h = Math.round(CH * qscale); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } invalidate(); }
  sizeCanvas();
  const tExt = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const gpuQ = []; let gpuAvg = null;

  const m4 = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
    rotX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]); },
    rotY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]); },
    persp(fovy, asp, n, f) { const t = 1 / Math.tan(fovy / 2); return new Float32Array([t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, (2 * f * n) / (n - f), 0]); },
    trans(x, y, z) { const m = m4.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  };
  const Rt = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[4] * v[0] + R[5] * v[1] + R[6] * v[2], R[8] * v[0] + R[9] * v[1] + R[10] * v[2]]; // R^T v
  const norm3 = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + "\n" + src.split("\n").map((l, i) => i + 1 + ": " + l).join("\n"));
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }

  /* ------------------------------------------------------------------- shaders */
  const HEAD = `#version 300 es
precision highp float; precision highp int;`;
  // Cast a local-space point back along the view ray to the front face (z = 0).
  const RAY = `
uniform vec3 uCam;
vec3 frontHit(vec3 P){ float t = -uCam.z/(P.z-uCam.z); return uCam + t*(P-uCam); }
vec2 cardUv(vec2 xy){ return vec2(xy.x + .5, .5 - xy.y/${H}); }`;
  const NOISE = `
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float fbm(vec2 p){ float a = .5, s = 0.; for(int i=0;i<4;i++){ s += a*vnoise(p); p = p*2.03 + 17.1; a *= .5; } return s; }`;

  // fbm from a lookup texture: three 256x256 periodic fields (R, G, B), one lattice cell = 16 texels at the base octave
  const NOISE_T = `
uniform sampler2D uNoise;
float nzR(vec2 p){ return texture(uNoise, p*(1./16.)).r; }
float nzG(vec2 p){ return texture(uNoise, p*(1./16.)).g; }
float nzB(vec2 p){ return texture(uNoise, p*(1./16.)).b; }`;

  const LAYER_VS = `${HEAD}
layout(location=0) in vec2 aUv;
uniform sampler2D uDepth;
uniform int uChan;
uniform vec4 uImg;        // left, top, width, height of the image on the card plane
uniform vec2 uUv0, uUvS;  // uv window (the background is oversized and edge-clamped)
uniform vec2 uZ;          // z at depth 1 (near) and at depth 0 (far); negative = into the block
uniform float uRelief, uDc, uFollow;
uniform sampler2D uBodyTex; uniform vec2 uZBody;   // the figure's alpha and depth range (for the background to follow)
uniform mat4 uVP, uRot; uniform vec3 uPivot;
out vec3 vLocal; out vec2 vUv;
void main(){
  vec2 uv = uUv0 + aUv*uUvS;
  vec3 d = textureLod(uDepth, clamp(uv, 0., 1.), 0.).rgb;
  float dv = uChan == 0 ? d.r : (uChan == 1 ? d.g : d.b);
  float zmid = .5*(uZ.x + uZ.y);
  float z = zmid + (mix(uZ.y, uZ.x, dv) - zmid)*uRelief;
  if(uChan == 0 && uFollow > 0.){
    // where the figure was cut out of the background, sit just behind the figure instead of far away:
    // otherwise a turn pulls the two apart and shows the hole the cut-out left
    float m = textureLod(uBodyTex, clamp(uv, 0., 1.), 4.).a;
    float zbm = .5*(uZBody.x + uZBody.y);
    float zb = zbm + (mix(uZBody.y, uZBody.x, d.g) - zbm)*uRelief;
    z = mix(z, zb - .03, smoothstep(.03, .45, m)*uFollow);
  }
  vec2 xy = vec2(uImg.x + uv.x*uImg.z, uImg.y - uv.y*uImg.w);
  xy *= (uDc - z)/uDc;                       // along the rest sight line: at rest it looks like the card art
  vec3 Pl = vec3(xy, z);
  vLocal = Pl; vUv = uv;
  gl_Position = uVP*(uRot*vec4(Pl - uPivot, 1.));
}`;
  const LAYER_FS = `${HEAD}
in vec3 vLocal; in vec2 vUv;
uniform sampler2D uTex, uMask;
uniform int uCut;
uniform float uBias, uAmber, uEdge, uGam;
uniform vec3 uSigma, uGlow;
out vec4 o;
${RAY}
void main(){
  vec3 qh = frontHit(vLocal);
  vec2 m = cardUv(qh.xy);
  if(m.x < 0. || m.x > 1. || m.y < 0. || m.y > 1.) discard;
  vec4 M = texture(uMask, m);
  if(M.r < .02) discard;
  vec4 c = texture(uTex, vUv, uBias);
  if(uGam < .999 && c.a > .003) c.rgb = pow(c.rgb/c.a, vec3(uGam))*c.a;
  if(uCut == 1){ vec2 w = step(vec2(0.), vUv)*step(vUv, vec2(1.)); c *= w.x*w.y; }
  float path = distance(vLocal, qh);
  float win = clamp(M.a, 0., 1.);                       // 0 at the window edge, 1 well inside
  path += uEdge*(1. - smoothstep(0., .8, win))*.22;     // thicker resin seen through the bevel
  vec3 tr = exp(-uSigma*path*uAmber);
  vec3 rgb = c.rgb*tr + uGlow*(vec3(1.) - tr)*c.a*.14;
  rgb *= mix(.62, 1., smoothstep(0., .55, win));
  o = vec4(rgb, c.a)*M.r;
}`;

  const QUAD_VS = `${HEAD}
layout(location=0) in vec2 aUv;
uniform mat4 uVP, uRot; uniform vec3 uPivot;
uniform float uQuadZ, uQuadScale;
out vec3 vLocal; out vec2 vUv;
void main(){
  vec3 Pl = vec3((aUv.x - .5)*uQuadScale, (.5 - aUv.y)*${H.toFixed(2)}*uQuadScale, uQuadZ);
  vLocal = Pl; vUv = aUv;
  gl_Position = uVP*(uRot*vec4(Pl - uPivot, 1.));
}`;

  const VEIL_FS = `${HEAD}
in vec3 vLocal; in vec2 vUv;
uniform sampler2D uMask;
uniform float uAlpha, uSeed, uScale, uAmber;
out vec4 o;
${RAY}
${NOISE_T}
void main(){
  vec3 qh = frontHit(vLocal);
  vec2 m = cardUv(qh.xy);
  if(m.x < 0. || m.x > 1. || m.y < 0. || m.y > 1.) discard;
  vec4 M = texture(uMask, m);
  if(M.r < .02) discard;
  vec2 p = vLocal.xy*uScale + uSeed;
  vec2 w = vec2(nzR(p + 3.1), nzG(p + 7.7));
  float n = nzB(p + 2.2*w);
  float a = uAlpha*uAmber*smoothstep(.28, .85, n);
  vec3 col = mix(vec3(1., .58, .10), vec3(1., .84, .42), n);
  a *= mix(.55, 1., smoothstep(0., .5, M.a));
  o = vec4(col*a, a)*M.r;
}`;

  const NSB = 16, WSTEPS = 24;
  const SIDE_VS = `${HEAD}
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aN; layout(location=2) in float aT;
uniform mat4 uVP, uRot; uniform vec3 uPivot;
out vec3 vLocal, vN; out float vT;
void main(){ vLocal = aPos; vN = aN; vT = aT; gl_Position = uVP*(uRot*vec4(aPos - uPivot, 1.)); }`;
  // The wall of the block. Its pixels refract the view into the resin and march through the sealed layers, so the side
  // shows the figure, the scene and the bubbles inside, tinted deeper the further in they are. Only wall pixels pay.
  const SIDE_FS = `${HEAD}
in vec3 vLocal, vN; in float vT;
uniform vec3 uCam, uL1, uL2, uUp, uSigma, uGlow;
uniform sampler2D uMask, uDepth, uBody, uBg;
uniform float uT0, uT1, uIor, uAmber, uRelief, uTime, uGloss, uDc, uZs, uSideDeep, uFog, uBub;
uniform vec4 uImg;
uniform vec4 uBubs[${NSB}];
out vec4 o;
${NOISE_T}
#define STEPS ${WSTEPS}
vec2 cardUv(vec2 xy){ return vec2(xy.x + .5, .5 - xy.y/${H.toFixed(2)}); }
vec2 imgUv(vec3 p){ vec2 xr = p.xy*uDc/(uDc - p.z); return vec2((xr.x - uImg.x)/uImg.z, (uImg.y - xr.y)/uImg.w); }
float Tf(float y){ return uT0 + (uT1 - uT0)*smoothstep(.55, -.55, y); }
float bfac(float y){ return smoothstep(.1, -.45, y); }
vec3 envC(vec3 r){
  float up = dot(r, uUp)*.5 + .5;
  vec3 c = mix(vec3(.10, .07, .04), vec3(.62, .52, .40), up*up);
  c += vec3(1.7, 1.5, 1.2)*smoothstep(.90, .985, dot(r, uL1));
  c += vec3(.75, .80, .92)*smoothstep(.93, .99, dot(r, uL2))*.7;
  c += vec3(.9, .78, .55)*smoothstep(.62, .95, sin(r.x*8. + r.y*1.5))*.16;
  return c;
}
void heights(vec3 p, out float sF, out float sG){
  vec2 uv = imgUv(p);
  vec3 dep = textureLod(uDepth, clamp(uv, 0., 1.), 0.).rgb;
  float zf = -.10*uZs, zg = -.23*uZs;
  sF = p.z - (zf + (mix(-.17*uZs, -.03*uZs, dep.g) - zf)*uRelief);
  sG = p.z - (zg + (mix(-.27*uZs, -.19*uZs, dep.r) - zg)*uRelief);
}
void main(){
  vec3 V = normalize(vLocal - uCam);
  vec3 N = normalize(vN);
  // the front edge turns over a rounded girdle: tilt the shading normal toward the viewer near the face
  float gt = smoothstep(0., .14, vT);
  N.z += (1. - gt)*.85; N = normalize(N);
  // a hand-polished wall is not perfectly true: low, slow undulation
  N = normalize(N + .05*vec3(nzR(vLocal.xy*7. + vLocal.z*3.) - .5, nzG(vLocal.yx*7. + 4.) - .5, (nzB(vec2(vLocal.z*18., vLocal.x*5.)) - .5)*.5));
  if(dot(N, V) > 0.) N = -N;
  float cosi = clamp(-dot(N, V), 0., 1.);
  float F = .045 + .955*pow(1. - cosi, 5.);
  vec3 sig = uSigma*(1. + 4.5*uSideDeep);

  vec3 d = refract(V, N, 1./uIor);
  vec3 p0 = vLocal - N*.003;
  float tMax = d.z < -.02 ? min((-Tf(p0.y) - p0.z)/d.z, 1.6) : 1.6;
  float dt = tMax/float(STEPS);
  vec3 accC = vec3(0.); float accA = 0.; float tEnd = tMax;
  float sF, sG; heights(p0, sF, sG);
  float tPrev = 0.;
  float jit = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
  for(int i = 1; i <= STEPS; i++){
    float t = dt*(float(i) - jit);
    vec3 p = p0 + d*t;
    vec2 m = cardUv(p.xy);
    float inside = (m.x > 0. && m.x < 1. && m.y > 0. && m.y < 1.) ? textureLod(uMask, m, 0.).r : 0.;
    if(inside < .5){                                    // out through a side wall: deep resin
      vec3 wc = mix(vec3(.62, .26, .05), vec3(1., .70, .22), pow(1. - cosi, 1.4))*exp(-sig*uAmber*.3*t);
      accC += (1. - accA)*wc; accA = 1.; tEnd = t; break;
    }
    if(p.z < -Tf(p.y)){                                 // the back of the wedge, lit through the resin
      float bf = bfac(p.y);
      vec3 bc = vec3(.92, .80, .66)*exp(-sig*uAmber*(1. + 1.2*bf)*t*1.3)*(.8 + .35*nzR(p.xy*2.8 + 4.));
      bc += uGlow*pow(nzG(p.xy*7. + 3.), 4.)*.5*(1. - bf);
      accC += (1. - accA)*bc; accA = 1.; tEnd = t; break;
    }
    float nF, nG; heights(p, nF, nG);
    if(sF > 0. && nF <= 0.){                            // crossed the sealed figure
      float th = tPrev + (t - tPrev)*sF/(sF - nF);
      vec2 uvh = imgUv(p0 + d*th);
      vec4 c = textureLod(uBody, uvh, 0.);
      c *= step(0., uvh.x)*step(uvh.x, 1.)*step(0., uvh.y)*step(uvh.y, 1.);
      if(c.a > .004){
        vec3 tr = exp(-sig*uAmber*(1. + 1.4*bfac(p.y))*th);
        accC += (1. - accA)*(c.rgb*tr + uGlow*(1. - tr)*c.a*.14); accA += (1. - accA)*c.a; tEnd = th;
      }
    }
    if(sG > 0. && nG <= 0.){                            // crossed the scene behind it (opaque)
      float th = tPrev + (t - tPrev)*sG/(sG - nG);
      vec3 c = textureLod(uBg, imgUv(p0 + d*th), 1.4).rgb;
      vec3 tr = exp(-sig*uAmber*(1. + 1.4*bfac(p.y))*th);
      accC += (1. - accA)*(c*tr + uGlow*(1. - tr)*.14); accA = 1.; tEnd = th; break;
    }
    if(accA > .985) break;
    sF = nF; sG = nG; tPrev = t;
  }
  if(accA < .999){ accC += (1. - accA)*vec3(.34, .135, .025); tEnd = tMax; }

  // drifting haze along the ray
  float tau = 0.;
  for(int k = 0; k < 6; k++){ float tt = tEnd*(float(k) + .5)/6.; vec3 p = p0 + d*tt; tau += uFog*(.25 + .9*nzR(p.xy*3.4 + p.z*6. + 2.))*(1. + .8*bfac(p.y))*tEnd/6.; }
  float trF = exp(-tau*2.0);
  accC = accC*trF + uGlow*(1. - trF)*.40;

  // bubbles: real spheres (negative radius = a glinting mote)
  for(int b = 0; b < ${NSB}; b++){
    vec4 s = uBubs[b]; float r = abs(s.w); if(r < .0001) continue;
    vec3 oc = p0 - s.xyz; float bb = dot(oc, d); float cc = dot(oc, oc) - r*r; float disc = bb*bb - cc;
    if(s.w > 0.){
      if(disc > 0.){
        float tb = -bb - sqrt(disc);
        if(tb > 0. && tb < tEnd){
          vec3 nb = normalize(p0 + d*tb - s.xyz);
          float rim = pow(1. - abs(dot(nb, d)), 2.), hl = pow(max(dot(reflect(d, nb), uL1), 0.), 30.);
          float a = clamp((.10 + rim*.55 + hl*.7)*uBub, 0., .9);
          accC = accC*(1. - a) + (vec3(1., .78, .36)*(.2 + rim*.9)*exp(-sig*uAmber*.5*tb) + vec3(1., .96, .82)*hl)*a;
        }
      }
    } else {
      float dist2 = max(cc + r*r - bb*bb, 0.), tc = -bb;
      if(tc > 0. && tc < tEnd){ float tw = .55 + .45*sin(uTime*(1.2 + fract(s.x*37.)*2.) + s.y*40.); accC += vec3(1., .9, .6)*exp(-dist2/(r*r*.8))*(.6 + .5*tw)*uBub*exp(-sig.y*uAmber*.4*tc); }
    }
  }

  // the wall of a sealed block: layered flow lines, light that entered through the face and scatters near the front edge,
  // the thick bottom going to cognac, a warm leak along the girdle
  float lay = nzR(vec2((vLocal.x + vLocal.y*.6)*2.4, vLocal.z*30.)), lay2 = nzG(vec2((vLocal.y - vLocal.x*.5)*5.1, vLocal.z*61. + 2.));
  accC *= mix(vec3(1.), vec3(1., .80, .50), .75);                                   // even thin resin on the wall reads as amber
  accC *= 1. + (lay - .5)*.55 + (lay2 - .5)*.25;
  accC += uGlow*(.10 + .34*exp(-vT*3.4))*(.7 + .3*lay);
  accC *= mix(1., .50, smoothstep(.40, 1., vT)*uSideDeep);
  accC *= 1. - .28*smoothstep(.05, -.5, vLocal.y);
  accC += uGlow*(1. - smoothstep(0., .08, vT))*pow(1. - cosi, 2.)*.5;                // the girdle catches the light

  vec3 R = reflect(V, N);
  vec3 H1 = normalize(uL1 - V), H2 = normalize(uL2 - V);
  float d1 = max(dot(N, H1), 0.), d2 = max(dot(N, H2), 0.);
  vec3 spec = vec3(1., .95, .85)*(pow(d1, 160.) + .07*pow(d1, 18.)) + vec3(.8, .9, 1.)*.5*pow(d2, 70.);
  o = vec4(accC*(1. - F*.7) + envC(R)*F*.7*uGloss + spec*uGloss*.7, 1.);
}`;
  const BACK_FS = `${HEAD}
in vec3 vLocal; in vec2 vUv;
uniform sampler2D uMask;
out vec4 o;
void main(){ float m = texture(uMask, vUv).r; if(m < .5) discard; float y = (.5 - vUv.y)*${H.toFixed(2)}; o = vec4(mix(vec3(.50, .22, .045), vec3(.20, .075, .014), smoothstep(.15, -.5, y)), 1.); }`;

  const FRONT_FS = `${HEAD}
in vec3 vLocal; in vec2 vUv;
uniform sampler2D uRim, uMask;
uniform vec3 uCam, uL1, uL2;
uniform float uGloss;
out vec4 o;
void main(){
  vec2 ruv = vec2((60. + vUv.x*896.)/1024., (50. + vUv.y*1385.)/1536.);
  vec4 rim = texture(uRim, ruv);
  vec4 M = texture(uMask, vUv);
  vec3 V = normalize(uCam - vLocal);
  vec2 e = vec2(1./${MW}., 1./${MH}.);
  float hL = texture(uMask, vUv - vec2(e.x*2., 0.)).b, hR = texture(uMask, vUv + vec2(e.x*2., 0.)).b;
  float hU = texture(uMask, vUv - vec2(0., e.y*2.)).b, hD = texture(uMask, vUv + vec2(0., e.y*2.)).b;
  float hh = texture(uMask, vUv).b;
  vec3 Nb = normalize(vec3(-(hR - hL)*2.6, (hD - hU)*2.6, 1.));          // bead of the rim: ridge in the middle
  vec2 c = vec2(vUv.x - .5, -(vUv.y - .36)*${H.toFixed(2)});
  vec3 Nw = normalize(vec3(c.x*.85, c.y*.85, 1.));                         // the window is a slightly domed pane
  float isWin = step(.5, M.r)*(1. - rim.a);
  vec3 N = isWin > .5 ? Nw : Nb;
  vec3 H1 = normalize(uL1 + V), H2 = normalize(uL2 + V);
  float d1 = max(dot(N, H1), 0.), d2 = max(dot(N, H2), 0.);
  vec3 spec = vec3(1., .95, .84)*(pow(d1, 110.) + .10*pow(d1, 14.)) + vec3(.78, .88, 1.)*.55*pow(d2, 60.);
  spec *= uGloss;
  // glints live on the curved bead of the rim; the big flat bed and the pane only get a faint sheen
  float slope = smoothstep(.015, .22, length(Nb.xy));
  vec3 col = rim.rgb + spec*rim.a*(.05 + 1.15*slope) + spec*isWin*.28;
  o = vec4(col, rim.a);
}`;

  const UI_FS = `${HEAD}
in vec3 vLocal; in vec2 vUv;
uniform sampler2D uTex;
out vec4 o;
void main(){ o = texture(uTex, vUv); }`;

  const BUB_VS = `${HEAD}
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aPos; layout(location=2) in vec2 aRS;   // centre (local), radius, seed
uniform mat4 uVP, uRot; uniform vec3 uPivot;
out vec2 vCorner; out vec3 vCenter; out vec2 vRS;
void main(){
  vec3 Wc = (uRot*vec4(aPos - uPivot, 1.)).xyz;
  vCorner = aCorner; vCenter = aPos; vRS = aRS;
  gl_Position = uVP*vec4(Wc + vec3(aCorner*aRS.x, 0.), 1.);
}`;
  const BUB_FS = `${HEAD}
in vec2 vCorner; in vec3 vCenter; in vec2 vRS;
uniform sampler2D uMask;
uniform float uAmber, uTime, uBub;
uniform vec3 uSigma;
out vec4 o;
${RAY}
void main(){
  float r = length(vCorner);
  if(r > 1.) discard;
  vec3 qh = frontHit(vCenter);
  vec2 m = cardUv(qh.xy);
  if(m.x < 0. || m.x > 1. || m.y < 0. || m.y > 1.) discard;
  vec4 M = texture(uMask, m);
  if(M.r < .02 || M.a < .12) discard;           // only where the window shows it
  float path = distance(vCenter, qh);
  vec3 tr = exp(-uSigma*path*uAmber*.6);
  vec3 col; float a;
  if(vRS.y < .62){                               // an air bubble: dark ring, bright rim, glint
    float ring = smoothstep(.5, .92, r)*(1. - smoothstep(.94, 1., r));
    vec2 hl = vec2(-.34, .38);
    float spec = exp(-dot((vCorner - hl)*3.4, (vCorner - hl)*3.4));
    col = vec3(1., .78, .36)*(.18 + ring*.95) + vec3(1., .96, .82)*spec;
    a = (.10 + ring*.55 + spec*.7)*uBub;
  } else {                                       // a sun spangle / mote: soft bright dot that glints
    float tw = .55 + .45*sin(uTime*(1.2 + vRS.y*2.) + vRS.y*40.);
    float g = exp(-r*r*3.2);
    col = vec3(1., .9, .6)*g*(.9 + .5*tw);
    a = g*.85*tw*uBub;
  }
  col *= tr;
  o = vec4(col*a, a);
}`;

  /* ----------------------------------------------------------------- programs */
  const pLayer = program(LAYER_VS, LAYER_FS);
  const pVeil = program(QUAD_VS, VEIL_FS);
  const pSide = program(SIDE_VS, SIDE_FS);
  const pBack = program(QUAD_VS, BACK_FS);
  const pFront = program(QUAD_VS, FRONT_FS);
  const pUI = program(QUAD_VS, UI_FS);
  const pBub = program(BUB_VS, BUB_FS);

  /* ------------------------------------------------------------------ geometry */
  function gridMesh(nx, ny) {
    const uv = new Float32Array((nx + 1) * (ny + 1) * 2); let k = 0;
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) { uv[k++] = i / nx; uv[k++] = j / ny; }
    const idx = new Uint32Array(nx * ny * 6); k = 0;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; idx.set([a, c, b, b, c, d], k); k += 6; }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, count: idx.length };
  }
  const grid = gridMesh(72, 90);
  const quad = (() => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null); return { vao, count: 6 };
  })();

  /* ------------------------------------------------------------------- assets */
  const load = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("加载失败 " + url)); i.src = url; });
  const [imgRim, imgPlate, imgBadge] = await Promise.all([load("asset:ui/amber-card-v2/body.png"), load("asset:ui/amber-card-v2/nameplate.png"), load("asset:ui/amber-card-v2/badge-atlas.png")]);
  const DATA = EmberData.byId;
  const className = (d) => (EmberData.classNames && EmberData.classNames[d.class]) || "中立";
  // Where each card's head is in its illustration (fraction of the picture's height from the top, and across): the figure layer
  // alone often misses it, because the automatic split can leave the head in the scene layer.
  const FOCUS = { treant: { ft: 0.03, fx: 0.60 }, sentinel: { ft: 0.27, fx: 0.50 }, moonfox: { ft: 0.14, fx: 0.38 }, moonguard: { ft: 0.02, fx: 0.52 }, selmyra: { ft: 0.03, fx: 0.45 }, jingchen: { ft: 0.03, fx: 0.32 }, aurion: { ft: 0.03, fx: 0.50 }, fenlos: { ft: 0.03, fx: 0.66 }, frostgolem: { ft: 0.03, fx: 0.52 }, tortoise: { ft: 0.12, fx: 0.60 }, bonelord: { ft: 0.06, fx: 0.35 }, pup: { ft: 0.15, fx: 0.60 }, nyx: { ft: 0.10, fx: 0.43 }, spiritwolf: { ft: 0.27, fx: 0.66 } };

  function texture(source, { mip = false, premul = true, wrap = gl.CLAMP_TO_EDGE } = {}) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premul); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return t;
  }
  const mk = (bg, body, front, depth) => ({ bg: texture(bg, { mip: true, wrap: gl.MIRRORED_REPEAT }), body: texture(body, { mip: true }), front: texture(front, { mip: true }), depth: texture(depth, { premul: false }) });
  let SET = null, tRim = null, tPlate = null, tGems = null, CARD = null;
  // an empty prop layer must not cost a full-card draw
  const nonEmpty = (img) => { const c = document.createElement("canvas"); c.width = 64; c.height = 80; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, 64, 80); const d = x.getImageData(0, 0, 64, 80).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 3) return true; return false; };
  // fbm noise as a texture: three 256x256 periodic fields (4 octaves each), lattice cell = 16 texels at the base octave
  const noiseTex = (() => {
    const S = 256, base = 16, data = new Uint8Array(S * S * 4);
    const lattice = (seed, n) => { let st = seed >>> 0; const a = new Float32Array(n * n); for (let i = 0; i < a.length; i++) { st = (st * 1664525 + 1013904223) >>> 0; a[i] = st / 4294967296; } return a; };
    const vn = (L, n, x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), i0 = ((x0 % n) + n) % n, i1 = (i0 + 1) % n, j0 = ((y0 % n) + n) % n, j1 = (j0 + 1) % n, a = L[j0 * n + i0], b = L[j0 * n + i1], c = L[j1 * n + i0], d = L[j1 * n + i1]; return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy; };
    for (let ch = 0; ch < 3; ch++) {
      const L = [0, 1, 2, 3].map((o) => lattice(1234 + ch * 977 + o * 31, base << o));
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const u = (x / S) * base, v = (y / S) * base; let sum = 0, amp = 0.5; for (let o = 0; o < 4; o++) { sum += amp * vn(L[o], base << o, u * (1 << o), v * (1 << o)); amp *= 0.5; } data[(y * S + x) * 4 + ch] = Math.min(255, sum * 255); }
    }
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, S, S, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  })();

  /* ----------------------------------------- data maps from the painted front face */
  // R silhouette (window filled in), G distance to the outside, B bead height of the rim, A distance into the window.
  const dataMaps = (() => {
    const c = document.createElement("canvas"); c.width = MW; c.height = MH;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(imgRim, 60, 50, 896, 1385, 0, 0, MW, MH);
    const px = x.getImageData(0, 0, MW, MH).data, N = MW * MH;
    const solid = new Uint8Array(N), outside = new Uint8Array(N);
    for (let i = 0; i < N; i++) solid[i] = px[i * 4 + 3] > 128 ? 1 : 0;
    // exterior = transparent pixels connected to the image border
    const stack = new Int32Array(N); let sp = 0;
    const seed = (i) => { if (!outside[i] && px[i * 4 + 3] <= 24) { outside[i] = 1; stack[sp++] = i; } };
    for (let i = 0; i < MW; i++) { seed(i); seed((MH - 1) * MW + i); } for (let j = 0; j < MH; j++) { seed(j * MW); seed(j * MW + MW - 1); }
    while (sp) { const i = stack[--sp], xx = i % MW, yy = (i / MW) | 0; if (xx > 0) seed(i - 1); if (xx < MW - 1) seed(i + 1); if (yy > 0) seed(i - MW); if (yy < MH - 1) seed(i + MW); }
    const inside = new Uint8Array(N); for (let i = 0; i < N; i++) inside[i] = outside[i] ? 0 : 1;
    // the visible outline (alpha > 100), for the side wall; the clip mask above keeps the soft halo
    const out2 = new Uint8Array(N), tight = new Uint8Array(N); sp = 0;
    const seed2 = (i) => { if (!out2[i] && px[i * 4 + 3] <= 100) { out2[i] = 1; stack[sp++] = i; } };
    for (let i = 0; i < MW; i++) { seed2(i); seed2((MH - 1) * MW + i); } for (let j = 0; j < MH; j++) { seed2(j * MW); seed2(j * MW + MW - 1); }
    while (sp) { const i = stack[--sp], xx = i % MW, yy = (i / MW) | 0; if (xx > 0) seed2(i - 1); if (xx < MW - 1) seed2(i + 1); if (yy > 0) seed2(i - MW); if (yy < MH - 1) seed2(i + MW); }
    for (let i = 0; i < N; i++) tight[i] = out2[i] ? 0 : 1;
    // chamfer distance transform: distance of every "on" pixel to the nearest "off" pixel
    function dt(on) {
      const d = new Float32Array(N), INF = 1e9;
      for (let i = 0; i < N; i++) d[i] = on[i] ? INF : 0;
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) { const i = y * MW + x; if (!d[i]) continue; let v = d[i];
        if (x > 0) v = Math.min(v, d[i - 1] + 1); if (y > 0) { v = Math.min(v, d[i - MW] + 1); if (x > 0) v = Math.min(v, d[i - MW - 1] + 1.414); if (x < MW - 1) v = Math.min(v, d[i - MW + 1] + 1.414); } d[i] = v; }
      for (let y = MH - 1; y >= 0; y--) for (let x = MW - 1; x >= 0; x--) { const i = y * MW + x; if (!d[i]) continue; let v = d[i];
        if (x < MW - 1) v = Math.min(v, d[i + 1] + 1); if (y < MH - 1) { v = Math.min(v, d[i + MW] + 1); if (x < MW - 1) v = Math.min(v, d[i + MW + 1] + 1.414); if (x > 0) v = Math.min(v, d[i + MW - 1] + 1.414); } d[i] = v; }
      return d;
    }
    const dSil = dt(inside);                                    // inside the whole silhouette -> distance to outside
    const dRing = dt(solid);                                    // inside the opaque rim -> distance to its edges
    const winOn = new Uint8Array(N); for (let i = 0; i < N; i++) winOn[i] = inside[i] && !solid[i] ? 1 : 0;
    const dWin = dt(winOn);                                     // inside the window -> distance to the rim
    const out = new Uint8Array(N * 4);
    for (let i = 0; i < N; i++) {
      out[i * 4] = inside[i] ? 255 : 0;
      out[i * 4 + 1] = Math.min(255, (dSil[i] / (0.06 * MW)) * 255);
      out[i * 4 + 2] = Math.min(255, (dRing[i] / (0.045 * MW)) * 255);
      out[i * 4 + 3] = Math.min(255, (dWin[i] / (0.07 * MW)) * 255);
    }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, MW, MH, 0, gl.RGBA, gl.UNSIGNED_BYTE, out);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return { tex: t, winOn, tight };
  })();

  /* --------------------------------------- the card's own text, plate and gems */
  // Same positions as card-face.css; drawn once into 2D canvases and mounted on the face.
  const UW = 1024, UH = Math.round(UW * H);
  function uiCanvas(draw) { const c = document.createElement("canvas"); c.width = UW; c.height = UH; const x = c.getContext("2d"); draw(x); return c; }
  const cq = UW / 100;
  const SERIF = (document.body && getComputedStyle(document.body).fontFamily) || '"Songti SC","STSong","Noto Serif CJK SC","SimSun",serif';
  // ---- text: the game's rules (card-face.css "rules on the amber bed"): size tier by length, narrower between the stat gems
  const KWS = ["战吼", "亡语", "法术伤害", "嘲讽", "圣盾", "突袭", "冲锋", "吸血", "剧毒", "风怒", "潜行", "复生", "冻结", "沉默", "发现", "奥秘"];
  const KW_RE = new RegExp("(" + KWS.join("|") + ")", "g");
  const TIER_MAX = [18, 28, 36, 44], TIER_K = [6.3, 5.6, 5.1, 4.8, 4.5], TIER_LINES = [3, 3, 4, 4, 4];
  const NO_LEAD = "。，、；：！？）」”…";
  function styled(text) { const out = []; let last = 0, m; KW_RE.lastIndex = 0; while ((m = KW_RE.exec(text))) { for (const ch of text.slice(last, m.index)) out.push({ ch, kw: false }); for (const ch of m[0]) out.push({ ch, kw: true }); last = m.index + m[0].length; } for (const ch of text.slice(last)) out.push({ ch, kw: false }); return out; }
  function layoutRules(x, text, hasStats) {
    const chars = styled(text), n = chars.length, tier = TIER_MAX.findIndex((m) => n <= m), t = tier < 0 ? TIER_MAX.length : tier;
    let k = TIER_K[t];
    const top = 0.702 * UH, gemTop = 0.789 * UH, wide = (hasStats ? 0.74 : 0.70) * UW, narrow = (0.761 - 0.246 - 0.04) * UW;
    for (let attempt = 0; attempt < 12; attempt++) {
      const fs = k * cq, lh = fs * 1.3, lines = []; let line = [], w = 0;
      const widthOf = (i) => { const yb = top + (i + 1) * lh; return hasStats && yb > gemTop + 0.002 * UH ? narrow : wide; };
      // a run of digits / latin / + / - is one unbreakable word ("+1/+1", "10/12"); CJK breaks anywhere except before closing punctuation
      const words = []; for (const c of chars) { const word = /[0-9A-Za-z+\-\/%.]/.test(c.ch); if (word && words.length && words[words.length - 1].word) words[words.length - 1].cs.push(c); else words.push({ cs: [c], word }); }
      for (const wd of words) {
        let ww = 0; for (const c of wd.cs) { x.font = `${c.kw ? 800 : 600} ${fs}px ${SERIF}`; c.w = x.measureText(c.ch).width; ww += c.w; }
        if (line.length && w + ww > widthOf(lines.length) && !NO_LEAD.includes(wd.cs[0].ch)) { lines.push({ cs: line, w }); line = []; w = 0; }
        for (const c of wd.cs) line.push(c); w += ww;
      }
      if (line.length) lines.push({ cs: line, w });
      if (lines.length <= TIER_LINES[t] + (attempt > 3 ? 1 : 0) && top + lines.length * lh <= 0.935 * UH) {
        // a short rule sat at the top of the bed with the rest empty: centre the block in the bed, as far as the stat gems allow
        let shift = Math.max(0, (0.866 * UH - top - lines.length * lh) / 2) * 0.92;
        if (hasStats) lines.forEach((ln, i) => { if (ln.w > narrow) shift = Math.min(shift, Math.max(0, gemTop + 0.002 * UH - (top + (i + 1) * lh))); });
        return { fs, lh, lines, top: top + shift };
      }
      k *= 0.93;
    }
    return { fs: k * cq, lh: k * cq * 1.3, lines: [], top };
  }
  const PLATE_FILTER = { common: "sepia(0.65)", rare: "none", epic: "sepia(0.3) hue-rotate(215deg)", legendary: "sepia(0.8) saturate(1.6)" };
  const TYPE_NAME = { minion: "随从", spell: "法术", weapon: "武器" };
  const TYPE_LIFT = 0.0147;                                                  // the line sat on the plaque's lower edge; this centres it
  function plateCanvas(d, rarity) {
    return uiCanvas((x) => {
      const dw = 0.56 * UW, dh = 0.081 * UH, dx = (UW - dw) / 2, dy = 0.599 * UH;
      x.save(); x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = 14; x.shadowOffsetY = 7; x.filter = PLATE_FILTER[rarity] || "none";
      x.drawImage(imgPlate, 0, 190, 1983, 415, dx, dy, dw, dh); x.restore();
      // name, shrunk to fit the plate
      x.textAlign = "center"; x.textBaseline = "middle";
      let nfs = 6.6 * cq; const fit = () => { x.font = `700 ${nfs}px ${SERIF}`; if ("letterSpacing" in x) x.letterSpacing = `${0.08 * nfs}px`; return x.measureText(d.name).width; };
      while (nfs > 3.4 * cq && fit() > 0.62 * dw) nfs -= 1; fit();
      x.fillStyle = "rgba(255,255,255,.45)"; x.fillText(d.name, UW / 2, dy + dh / 2 + 3);
      x.fillStyle = "#18140f"; x.fillText(d.name, UW / 2, dy + dh / 2);
      if ("letterSpacing" in x) x.letterSpacing = "0px";
      // rules
      const hasStats = d.type !== "spell", L = layoutRules(x, d.text || "", hasStats);
      x.textAlign = "left"; x.textBaseline = "alphabetic";
      L.lines.forEach((ln, i) => {
        let cx = (UW - ln.w) / 2; const y = L.top + i * L.lh + L.fs * 1.02;
        for (const c of ln.cs) { x.font = `${c.kw ? 800 : 600} ${L.fs}px ${SERIF}`; x.fillStyle = "#000a"; x.fillText(c.ch, cx, y + 3); x.fillStyle = c.kw ? "#ffd98a" : "#fff0d0"; x.fillText(c.ch, cx, y); cx += x.measureText(c.ch).width; }
      });
      // type line engraved on the sill
      const tl = `${TYPE_NAME[d.type] || "随从"} · ${d.className}`;
      x.textAlign = "center"; x.textBaseline = "middle"; x.fillStyle = "rgba(255,240,200,.62)"; x.font = `800 ${4.7 * cq}px ${SERIF}`; if ("letterSpacing" in x) x.letterSpacing = `${0.07 * 4.7 * cq}px`;
      const ty = 0.967 * UH - 3.7 * cq - TYPE_LIFT * UH;
      x.fillText(tl, UW / 2, ty + 2); x.fillStyle = "#33170a"; x.fillText(tl, UW / 2, ty);
    });
  }
  function gemCanvas(d) {
    return uiCanvas((x) => {
      const gem = (box, path, dx, dy, dw, dh, value, size, lift = 0, filter = "none") => {
        x.save(); x.shadowColor = "rgba(0,0,0,.75)"; x.shadowBlur = 16; x.shadowOffsetY = 8; x.filter = filter;
        x.translate(dx, dy); x.scale(dw / box[2], dh / box[3]); x.translate(-box[0], -box[1]);
        const p = new Path2D(path); x.save(); x.clip(p); x.drawImage(imgBadge, 0, 0); x.restore(); x.restore();
        const two = String(value).length > 1, fs = size * (two ? 0.8 : 1);
        x.save(); x.textAlign = "center"; x.textBaseline = "middle"; x.font = `700 ${fs}px -apple-system,"PingFang SC",${SERIF}`;
        x.lineJoin = "round"; x.lineWidth = Math.max(2, 0.6 * cq); x.strokeStyle = "#2b1504"; x.shadowColor = "rgba(0,0,0,.8)"; x.shadowBlur = 8; x.shadowOffsetY = 3;
        x.strokeText(String(value), dx + dw / 2, dy + dh / 2 + lift * dh); x.shadowColor = "transparent"; x.fillStyle = "#fff1cd"; x.fillText(String(value), dx + dw / 2, dy + dh / 2 + lift * dh); x.restore();
      };
      const s = 0.203 * UW;
      gem([207, 172, 182, 172], "M298 176 A84 84 0 1 1 297.9 176Z", 0.164 * UW, 0.088 * UH, s, s, d.cost, 10 * cq);
      if (d.type === "spell") return;
      const g = 0.235 * UW, top = UH * (1 - 0.052) - g;
      gem([72, 1131, 205, 231], "M173 1131 L277 1199 L269 1301 L170 1362 L72 1300 L72 1197Z", 0.011 * UW, top, g, g, d.atk, 12.5 * cq);
      // a weapon's second number is durability: the same heart in steel blue, as the game draws it
      gem([731, 1150, 222, 218], "M841 1173 C907 1117 984 1180 938 1261 Q910 1318 837 1368 Q772 1324 743 1254 C712 1186 780 1125 841 1173Z", UW - 0.004 * UW - g, top, g, g, d.hp, 12.5 * cq, -0.06, d.type === "weapon" ? "hue-rotate(195deg) saturate(.85) brightness(1.05)" : "none");
    });
  }

  // ---- the frame: hue follows the class, the apex stone follows the rarity (recoloured from the one painted frame)
  // [hue shift, saturation x, value x] of the painted frame: the four classes read as four stones at a glance
  const FRAME_SHIFT = { neutral: [0, 1, 1], mage: [178, 0.82, 0.92], paladin: [8, 0.70, 1.0], ranger: [62, 0.62, 0.80], plain: [0, 1, 1] };
  const GEM_LOOK = { common: [32, 0.75, 1.08, 0], rare: [215, 1, 1, 1], epic: [282, 1, 1, 0], legendary: [358, 1.12, 1, 0] };   // [hue, sat, val, keep original]
  const rimCache = {};
  function rgb2hsv(r, g, b) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx / 255]; }
  function hsv2rgb(h, s, v) { h = ((h % 360) + 360) % 360; const c = v * s, x2 = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; let r = 0, g = 0, b = 0; if (h < 60) [r, g, b] = [c, x2, 0]; else if (h < 120) [r, g, b] = [x2, c, 0]; else if (h < 180) [r, g, b] = [0, c, x2]; else if (h < 240) [r, g, b] = [0, x2, c]; else if (h < 300) [r, g, b] = [x2, 0, c]; else [r, g, b] = [c, 0, x2]; return [(r + m) * 255, (g + m) * 255, (b + m) * 255]; }
  function rimTexture(cls, rarity) {
    const key = cls + "|" + rarity; if (rimCache[key]) return rimCache[key];
    const [dh, ds, dv] = FRAME_SHIFT[cls] || FRAME_SHIFT.neutral, [gh, gs, gv, keep] = GEM_LOOK[rarity] || GEM_LOOK.rare;
    const c = document.createElement("canvas"); c.width = imgRim.width; c.height = imgRim.height; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(imgRim, 0, 0);
    if (dh || ds !== 1 || dv !== 1 || !keep) {
      const im = x.getImageData(0, 0, c.width, c.height), d = im.data, W = c.width;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 8) continue;
        const px = (i >> 2) % W, py = ((i >> 2) / W) | 0, r = d[i], g = d[i + 1], b = d[i + 2];
        const inGem = px > 460 && px < 566 && py > 48 && py < 142 && b > r + 20 && b > g;      // the sapphire at the apex
        if (inGem) { if (keep) continue; const [h, s2, v] = rgb2hsv(r, g, b), o = hsv2rgb(h - 215 + gh, Math.min(1, s2 * gs), Math.min(1, v * gv)); d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2]; continue; }
        if (!dh && ds === 1 && dv === 1) continue;
        const [h, s2, v] = rgb2hsv(r, g, b); if (s2 < 0.22) continue;                         // leave highlights and the silver alone
        const o = hsv2rgb(h + dh, Math.min(1, s2 * ds), Math.min(1, v * dv)); d[i] = o[0]; d[i + 1] = o[1]; d[i + 2] = o[2];
      }
      x.putImageData(im, 0, 0);
    }
    return (rimCache[key] = texture(c, { mip: true }));
  }

  /* ------------------------------------------------- the side wall (extruded outline) */
  // The outline is star-shaped about the card centre: walk a ray out to the edge for each angle.
  const outline = (() => {
    const n = 288, r = new Float32Array(n), tight = dataMaps.tight;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n, ca = Math.cos(a), sa = Math.sin(a); let last = 0;
      for (let k = 0; k < 1000; k++) { const rr = k * 0.001, x = ca * rr, y = sa * rr, px = Math.round((x + 0.5) * MW - 0.5), py = Math.round(((H / 2 - y) / H) * MH - 0.5);
        if (px < 0 || px >= MW || py < 0 || py >= MH || !tight[py * MW + px]) break; last = rr; }
      r[i] = last;
    }
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) sm[i] = (r[(i + n - 2) % n] + 2 * r[(i + n - 1) % n] + 3 * r[i] + 2 * r[(i + 1) % n] + r[(i + 2) % n]) / 9;
    const pts = [], nrm = [];
    for (let i = 0; i < n; i++) { const a = (2 * Math.PI * i) / n; pts.push([Math.cos(a) * sm[i], Math.sin(a) * sm[i]]); }
    for (let i = 0; i < n; i++) { const p0 = pts[(i + n - 1) % n], p1 = pts[(i + 1) % n]; let tx = p1[0] - p0[0], ty = p1[1] - p0[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      let nx = ty, ny = -tx; if (nx * pts[i][0] + ny * pts[i][1] < 0) { nx = -nx; ny = -ny; } nrm.push([nx, ny]); }
    return { pts, nrm, n };
  })();
  const wall = { vao: gl.createVertexArray(), vb: gl.createBuffer(), ib: gl.createBuffer(), count: 0 };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // a wedge: thin and clear at the top, thick and dark at the bottom. P.T is the average thickness.
  const T0 = () => P.T * (1 - 0.45 * P.wedge), T1 = () => P.T * (1 + 0.45 * P.wedge);
  const thickAt = (y) => T0() + (T1() - T0()) * smooth(0.55, -0.55, y);
  const sZ = () => T0() / 0.34;                                   // the sealed layers live in the thin top, so they scale with it
  function buildWall() {
    const { pts, nrm, n } = outline, R = 20;
    // the back edge is rounded; the front edge turns over a girdle that is shaded, not modelled
    const inset = (t) => 0.034 * Math.pow(Math.max(0, (t - 0.74) / 0.26), 2);
    const v = new Float32Array((R + 1) * n * 7);
    for (let k = 0; k <= R; k++) {
      const t = k / R, d = inset(t), eps = 0.01;
      for (let i = 0; i < n; i++) {
        const th = thickAt(pts[i][1]), slope = (inset(Math.min(1, t + eps)) - inset(Math.max(0, t - eps))) / (2 * eps * th);
        const nx = nrm[i][0], ny = nrm[i][1], o = (k * n + i) * 7, nn = Math.hypot(nx, ny, slope) || 1;
        v.set([pts[i][0] - nx * d, pts[i][1] - ny * d, -th * t, nx / nn, ny / nn, -slope / nn, t], o);
      }
    }
    const idx = new Uint32Array(R * n * 6); let c = 0;
    for (let k = 0; k < R; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + ((i + 1) % n), cc = (k + 1) * n + i, d2 = (k + 1) * n + ((i + 1) % n); idx.set([a, cc, b, b, cc, d2], c); c += 6; }
    gl.bindVertexArray(wall.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, wall.vb); gl.bufferData(gl.ARRAY_BUFFER, v, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wall.ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null); wall.count = idx.length;
  }
  buildWall();

  /* ------------------------------------------------------------------ bubbles */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const windowPix = []; for (let i = 0; i < MW * MH; i++) if (dataMaps.winOn[i]) windowPix.push(i);
  let bubbleBuckets = [], sideBubs = new Float32Array(NSB * 4);       // per bucket: Float32Array of [x,y,z,r,seed]*n
  function layerKeys() { const s = sZ(); return [-0.22 * s, -0.15 * s, -0.10 * s, -0.07 * s, -0.05 * s, -0.025 * s]; }
  const bubCorner = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, bubCorner);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
  const bubbleGL = [];
  function rebuildBubbles() {
    const rand = rng(7 + (CARD ? CARD.seed : 0) * 13), n = Math.round(78 * P.bubbles), s = sZ(), keys = layerKeys();
    const buckets = keys.map(() => []).concat([[]]);
    for (let b = 0; b < n; b++) {
      const pi = windowPix[Math.floor(rand() * windowPix.length)], x = ((pi % MW) + rand()) / MW - 0.5, y = H / 2 - (((pi / MW) | 0) + rand()) / MH * H;
      const z = -(0.03 + Math.pow(rand(), 0.8) * 0.225) * s, mote = rand() < 0.28;
      const r = mote ? 0.010 + rand() * 0.014 : 0.0045 + Math.pow(rand(), 2.4) * 0.016;
      const bucket = keys.filter((k) => k < z).length;                 // layers farther than this bubble
      buckets[bucket].push(x, y, z, r, mote ? 0.7 + rand() * 0.3 : rand() * 0.55);
    }
    bubbleBuckets = buckets.map((a) => Float32Array.from(a));
    // uploaded once per rebuild, not every frame
    bubbleBuckets.forEach((arr, i) => {
      const g = bubbleGL[i] || (bubbleGL[i] = { vao: gl.createVertexArray(), buf: gl.createBuffer() });
      gl.bindVertexArray(g.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, bubCorner); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.buf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 20, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 20, 12); gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null);
    });
    // the wall sees them as spheres (a mote has a negative radius); spread a shortlist over every depth
    const all = []; bubbleBuckets.forEach((arr) => { for (let k = 0; k < arr.length; k += 5) all.push([arr[k], arr[k + 1], arr[k + 2], arr[k + 3], arr[k + 4]]); });
    sideBubs = new Float32Array(NSB * 4); const stride = Math.max(1, all.length / NSB);
    for (let k = 0; k < NSB && Math.floor(k * stride) < all.length; k++) { const e = all[Math.floor(k * stride)]; sideBubs.set([e[0], e[1], e[2], e[4] < 0.62 ? e[3] : -e[3]], k * 4); }
  }
  rebuildBubbles();

  /* --------------------------------------------------------------------- pose */
  const pose = { ax: 0, ay: 0, tx: 0, ty: 0, vx: 0, vy: 0 };
  let dragging = false, lastMove = -1e9, lastT = performance.now();
  const frozen = false;
  function aim(px, py) {
    const k = 0.32, kx = 0.22;
    pose.ty = Math.max(-0.62, Math.min(0.62, px * 2 * k * P.range));
    pose.tx = Math.max(-0.55, Math.min(0.55, py * 2 * kx * P.range));
    lastMove = performance.now(); invalidate();
  }
  function applyLayers(name) {
    if (!CARD || !CARD.sets[name]) return;
    SET = CARD.sets[name]; CARD.setName = name; P.follow = SET.follow;
  }

  /* ------------------------------------------------------------------- render */
  const DC = 3.4;
  const FOV = 2 * Math.atan((H / 2 / 0.86) / DC);
  let SIGMA = [0.12, 0.62, 1.9], GLOW = [1.0, 0.62, 0.16];
  const LIGHT1 = norm3([-0.50, 0.56, 0.66]), LIGHT2 = norm3([0.62, -0.32, 0.72]);
  // image placed on the card plane, covering the art window like object-fit: cover; object-position 50% 18%
  const ART_TOP = H / 2, ART_H = 0.6426 * H;
  let IMG = [-0.5, ART_TOP, 1, 1.3];

  function bindTex(unit, tex) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }
  function common(pr, M) {
    gl.useProgram(pr.p);
    const u = pr.u;
    if (u.uVP) gl.uniformMatrix4fv(u.uVP, false, M.vp);
    if (u.uRot) gl.uniformMatrix4fv(u.uRot, false, M.R);
    if (u.uPivot) gl.uniform3f(u.uPivot, 0, 0, -P.T / 2);
    if (u.uCam) gl.uniform3fv(u.uCam, M.cam);
    if (u.uL1) gl.uniform3fv(u.uL1, M.l1);
    if (u.uL2) gl.uniform3fv(u.uL2, M.l2);
  }
  function drawLayer(M, { tex, chan, z, uv0, uvS, cut, bias, edge = 1 }) {
    common(pLayer, M); const u = pLayer.u;
    bindTex(0, tex); bindTex(1, SET.depth); bindTex(2, dataMaps.tex);
    gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uDepth, 1); gl.uniform1i(u.uMask, 2);
    gl.uniform1i(u.uChan, chan); gl.uniform4fv(u.uImg, IMG); gl.uniform2fv(u.uUv0, uv0); gl.uniform2fv(u.uUvS, uvS);
    gl.uniform2f(u.uZ, M.flat ? 0 : z[0], M.flat ? 0 : z[1]); gl.uniform1f(u.uRelief, M.flat ? 0 : P.relief); gl.uniform1f(u.uDc, DC);
    gl.uniform1i(u.uCut, cut); gl.uniform1f(u.uBias, bias); gl.uniform1f(u.uAmber, M.flat ? 0 : P.amber); gl.uniform1f(u.uEdge, M.flat ? 0 : edge);
    gl.uniform3fv(u.uSigma, SIGMA); gl.uniform3fv(u.uGlow, GLOW); gl.uniform1f(u.uGam, M.flat ? 1 : P.gam);
    bindTex(3, SET.body); gl.uniform1i(u.uBodyTex, 3); gl.uniform2f(u.uZBody, M.flat ? 0 : -0.03 * sZ(), M.flat ? 0 : -0.17 * sZ());
    gl.uniform1f(u.uFollow, chan === 0 && !M.flat ? P.follow : 0);
    gl.bindVertexArray(grid.vao); gl.drawElements(gl.TRIANGLES, grid.count, gl.UNSIGNED_INT, 0);
  }
  function drawQuad(pr, M, z, scale = 1) {
    gl.uniform1f(pr.u.uQuadZ, z); gl.uniform1f(pr.u.uQuadScale, scale);
    gl.bindVertexArray(quad.vao); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function drawVeil(M, z, alpha, seed, scale) {
    common(pVeil, M); bindTex(0, dataMaps.tex); gl.uniform1i(pVeil.u.uMask, 0); bindTex(5, noiseTex); gl.uniform1i(pVeil.u.uNoise, 5);
    gl.uniform1f(pVeil.u.uAlpha, alpha); gl.uniform1f(pVeil.u.uSeed, seed); gl.uniform1f(pVeil.u.uScale, scale); gl.uniform1f(pVeil.u.uAmber, P.amber);
    drawQuad(pVeil, M, z, 1.4);
  }
  function drawBubbles(M, i) {
    const g = bubbleGL[i], n = bubbleBuckets[i] ? bubbleBuckets[i].length / 5 : 0; if (!g || !n) return;
    common(pBub, M); bindTex(0, dataMaps.tex); gl.uniform1i(pBub.u.uMask, 0);
    gl.uniform1f(pBub.u.uAmber, P.amber); gl.uniform1f(pBub.u.uTime, M.time); gl.uniform1f(pBub.u.uBub, 1); gl.uniform3fv(pBub.u.uSigma, SIGMA);
    gl.bindVertexArray(g.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
  }
  function drawSide(M) {
    common(pSide, M); const u = pSide.u;
    bindTex(0, dataMaps.tex); bindTex(1, SET.depth); bindTex(2, SET.body); bindTex(3, SET.bg); bindTex(5, noiseTex);
    gl.uniform1i(u.uMask, 0); gl.uniform1i(u.uDepth, 1); gl.uniform1i(u.uBody, 2); gl.uniform1i(u.uBg, 3); gl.uniform1i(u.uNoise, 5);
    gl.uniform3fv(u.uUp, M.up); gl.uniform4fv(u.uImg, IMG); gl.uniform3fv(u.uSigma, SIGMA); gl.uniform3fv(u.uGlow, GLOW);
    gl.uniform1f(u.uT0, T0()); gl.uniform1f(u.uT1, T1()); gl.uniform1f(u.uIor, 1.54); gl.uniform1f(u.uAmber, P.amber); gl.uniform1f(u.uRelief, P.relief);
    gl.uniform1f(u.uTime, M.time); gl.uniform1f(u.uGloss, P.gloss); gl.uniform1f(u.uDc, DC); gl.uniform1f(u.uZs, sZ()); gl.uniform1f(u.uSideDeep, P.sidedeep);
    gl.uniform1f(u.uFog, 1); gl.uniform1f(u.uBub, 1); gl.uniform4fv(u.uBubs, sideBubs);
    gl.bindVertexArray(wall.vao); gl.drawElements(gl.TRIANGLES, wall.count, gl.UNSIGNED_INT, 0);
  }

  function render(time) {
    const flat = P.flat, s = sZ();
    const R = m4.mul(m4.rotY(pose.ay), m4.rotX(pose.ax));
    const cam = Rt(R, [0, 0, DC + P.T / 2]); cam[2] -= P.T / 2;
    const vp = m4.mul(m4.persp(FOV, CW / CH, 0.1, 30), m4.trans(0, 0, -(DC + P.T / 2)));
    const M = { R, vp, cam, l1: Rt(R, LIGHT1), l2: Rt(R, LIGHT2), up: Rt(R, [0, 1, 0]), flat, time };
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // 1. the block's back face and its side wall: the outline extruded back from the painted face
    if (!flat) {
      common(pBack, M); bindTex(0, dataMaps.tex); gl.uniform1i(pBack.u.uMask, 0); drawQuad(pBack, M, -T0() * 0.98, 1);
      if (!SKIP.has("wall")) drawSide(M);
    }
    // 2. the inside, farthest first: illustration layers, resin veils and bubbles interleaved by depth
    const keys = layerKeys();
    const items = [
      (m) => P.showBg && !SKIP.has("bg") && drawLayer(m, { tex: SET.bg, chan: 0, z: [-0.19 * s, -0.27 * s], uv0: [-0.14, -0.1], uvS: [1.28, 1.2], cut: 0, bias: 1.3 }),
      (m) => !m.flat && !SKIP.has("veil") && drawVeil(m, -0.15 * s, 0.15, 1.7, 3.1),
      (m) => P.showBody && !SKIP.has("body") && drawLayer(m, { tex: SET.body, chan: 1, z: [-0.03 * s, -0.17 * s], uv0: [0, 0], uvS: [1, 1], cut: 1, bias: 0 }),
      (m) => !m.flat && !SKIP.has("veil") && drawVeil(m, -0.07 * s, 0.09, 4.3, 4.4),
      (m) => SET.hasFront && drawLayer(m, { tex: SET.front, chan: 2, z: [-0.02 * s, -0.06 * s], uv0: [0, 0], uvS: [1, 1], cut: 1, bias: 0 }),
      (m) => !m.flat && !SKIP.has("veil") && drawVeil(m, -0.025 * s, 0.05, 8.8, 6.0),
    ];
    for (let i = 0; i < items.length; i++) { if (!flat && !SKIP.has("bub")) drawBubbles(M, i); items[i](M); }
    if (!flat) drawBubbles(M, items.length);

    // 3. the painted front face of the block (with moving highlights), then what is mounted on it
    common(pFront, M); bindTex(0, tRim); bindTex(1, dataMaps.tex);
    gl.uniform1i(pFront.u.uRim, 0); gl.uniform1i(pFront.u.uMask, 1); gl.uniform1f(pFront.u.uGloss, flat ? 0 : P.gloss);
    if (!SKIP.has("front")) drawQuad(pFront, M, 0, 1);
    if (P.ui && !SKIP.has("ui")) {
      common(pUI, M); bindTex(0, tPlate); gl.uniform1i(pUI.u.uTex, 0); drawQuad(pUI, M, flat ? 0.002 : 0.012, 1);
      bindTex(0, tGems); drawQuad(pUI, M, flat ? 0.002 : 0.034, 1);
    }
  }


  /* ---------------------------------------------------------------- the cards */
  // The resin for each class: absorption per unit path and the colour it glows.
  const CLASS_RESIN = {
    neutral: { sigma: [0.12, 0.62, 1.9], glow: [1.0, 0.62, 0.16], name: "蜜珀" },
    paladin: { sigma: [0.12, 0.50, 1.6], glow: [1.0, 0.76, 0.32], name: "金珀" },
    ranger: { sigma: [0.80, 0.12, 0.90], glow: [0.45, 0.90, 0.35], name: "绿珀" },
    mage: { sigma: [1.50, 0.55, 0.10], glow: [0.28, 0.55, 1.0], name: "蓝珀" },
    plain: { sigma: [0.12, 0.62, 1.9], glow: [1.0, 0.62, 0.16], name: "蜜珀" },
  };
  const CLASS_KEY = { mage: "mage", paladin: "paladin", ranger: "ranger", neutral: "neutral" };
  const RARITY_NAME = { common: "普通", rare: "稀有", epic: "史诗", legendary: "传说" };
  const states = {};
  const HEAD_Y = 0.255, WIN_TOP = 0.13, WIN_BOT = 0.95, WIN_HALF = 0.36, MIRROR = 0.07;   // card units: head line, window top/bottom, half width, how far the background is mirrored out
  // where the figure's head starts, as a fraction of the image height: the first rows with a real run of opaque pixels
  function figureTop(img) {
    const w = 96, h = Math.max(1, Math.round(96 * (img.height || img.naturalHeight) / (img.width || img.naturalWidth))), c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    for (let y = 0; y < h; y++) { let n = 0; for (let k = 0; k < w; k++) if (d[(y * w + k) * 4 + 3] > 150) n++; if (n >= w * 0.05) return y / h; }
    return 0;
  }
  // dark pictures get their shadows lifted (gamma < 1) so the subject still reads through the resin; very bright ones are deepened a little (gamma > 1) so the pale resin does not bleach them
  function gammaFor(bg, body) {
    const w = 48, h = 64, c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(bg, 0, 0, w, h); x.drawImage(body, 0, 0, w, h);
    const d = x.getImageData(Math.round(w * 0.12), Math.round(h * 0.1), Math.round(w * 0.76), Math.round(h * 0.65)).data; let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { sum += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255; n++; }
    const luma = sum / n; return { luma, g: luma < 0.34 ? 0.70 + 0.30 * (luma / 0.34) : 1 + 0.30 * Math.min(1, Math.max(0, (luma - 0.52) / 0.2)) };
  }
  const flatSet = (img) => {
    // no baked layers (the single-file build): the flat illustration is the scene, nothing is in front of it and every
    // depth is the middle, so the card is still amber but does not move inside
    const cv = document.createElement("canvas"); cv.width = img.naturalWidth || img.width; cv.height = img.naturalHeight || img.height;
    const empty = document.createElement("canvas"); empty.width = 4; empty.height = 4;
    const dp = document.createElement("canvas"); dp.width = 4; dp.height = 4; const dx = dp.getContext("2d"); dx.fillStyle = "rgb(128,128,128)"; dx.fillRect(0, 0, 4, 4);
    cv.getContext("2d").drawImage(img, 0, 0);
    return { bg: cv, body: empty, front: empty, depth: dp };
  };
  async function prepareCard(id, idx) {
    const d = DATA[id]; if (!d) throw new Error("no such card: " + id);
    const L = typeof EmberAmberLayers !== "undefined" ? EmberAmberLayers[id] : null;
    let imgs, follow = 0, hasFront = false;
    try {
      if (!L) throw new Error("no layers");
      imgs = await Promise.all([load(L.bg), load(L.body), L.front ? load(L.front) : null, load(L.depth)]);
      follow = L.follow; hasFront = !!L.front;
    } catch (e) {
      const art = await load(EmberArt.card(d)); const f = flatSet(art);
      imgs = [f.bg, f.body, null, f.depth];
    }
    const [bg, body, front, depth] = imgs;
    const empty = front || (() => { const c = document.createElement("canvas"); c.width = 4; c.height = 4; return c; })();
    const set = mk(bg, body, empty, depth); set.hasFront = hasFront; set.follow = follow;
    const st = { id, d: { ...d, className: className(d) }, seed: idx + 1, cls: CLASS_KEY[d.class] || "neutral", rarity: d.rarity, sets: { old: set }, aspect: (bg.height || bg.naturalHeight) / (bg.width || bg.naturalWidth), setName: "old", thumb: null };
    st.figTop = figureTop(body); st.gam = gammaFor(bg, body);
    states[id] = st; return st;
  }
  // the plate and gem textures depend on the card, its rarity and any displayed overrides (a cost the game has changed)
  function uiFor(st, ov) {
    const key = (ov ? JSON.stringify(ov) : "") + "|" + st.rarity; st.ui = st.ui || {};
    if (!st.ui[key]) { const d = ov ? { ...st.d, ...ov } : st.d; st.ui[key] = { tPlate: texture(plateCanvas(d, st.rarity)), tGems: texture(gemCanvas(d)) }; }
    return st.ui[key];
  }
  function dropUI(st) { for (const u of Object.values(st.ui || {})) { gl.deleteTexture(u.tPlate); gl.deleteTexture(u.tGems); } st.ui = {}; }
  function selectCard(id, { quiet = false, ov = null } = {}) {
    const st = states[id]; if (!st) return;
    CARD = st;
    const ui = uiFor(st, ov); tPlate = ui.tPlate; tGems = ui.tGems; tRim = rimTexture(P.classTint ? st.cls : "plain", st.rarity);
    const res = CLASS_RESIN[P.classTint ? st.cls : "plain"]; SIGMA = res.sigma; GLOW = res.glow;
    // Framing. The game fits the art into a rectangle (object-fit: cover, a per-card object-position); the amber window is an
    // arch, narrower at the top, so the same framing loses heads under the apex. "arch" framing puts the subject's head a
    // fixed distance below the apex (HEAD_Y), where the arch is already wide, and shows the picture a little smaller so the arch
    // has more of it to show. The head's height comes from focus.json (read off the art by eye) or, failing that, from the top of
    // the figure layer; the picture may start a little below the window's top edge because the background layer is mirrored out.
    const ih = st.aspect, posY = parseFloat(((AtelierArt.framing(st.id, "card") || {}).pos || "50% 30%").split(" ")[1]) / 100, fo = FOCUS[st.id] || {};
    let sc = 1, topY, offX = 0;                                           // topY: image top below the card top, in card units
    if (P.arch) {
      sc = fo.z || P.zoom; const hh = ih * sc, fx = fo.fx != null ? fo.fx : 0.5;
      if (st.d.type === "minion" || fo.ft != null) {                      // a figure: head just below the apex
        const ft = fo.ft != null ? fo.ft : st.figTop;
        topY = Math.min(HEAD_Y - ft * hh, WIN_TOP + MIRROR * hh);
      } else topY = WIN_TOP - (hh - (WIN_BOT - WIN_TOP)) * posY;           // a spell or a weapon: the game's own vertical position
      topY = Math.max(topY, WIN_BOT - hh);
      const room = Math.max(0, sc / 2 - WIN_HALF); offX = Math.max(-room, Math.min(room, (0.5 - fx) * sc));
    } else { const hh = Math.max(ih, ART_H); topY = 0 - (hh - ART_H) * posY; }
    IMG = [-sc / 2 + offX, H / 2 - topY, sc, ih * sc];
    P.gam = st.gam ? st.gam.g : 1;
    applyLayers(st.setName);
    rebuildBubbles();
    invalidate();
  }
  /* ------------------------------------------------------------- the renderer's API */
  const pending = {};
  const hashSeed = (id) => [...id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7) % 40;
  // a hand needs a few dozen cards at most; each holds ~13 MB of textures, so the least recently used ones are given back
  const KEEP = keep, order = [];
  const touch = (id) => { const i = order.indexOf(id); if (i >= 0) order.splice(i, 1); order.push(id); };
  function releaseCard(id) {
    const st = states[id]; if (!st) { const j = order.indexOf(id); if (j >= 0) order.splice(j, 1); return; }
    if (st === CARD) return;
    for (const set of Object.values(st.sets)) for (const t of [set.bg, set.body, set.front, set.depth]) gl.deleteTexture(t);
    dropUI(st); delete states[id]; const i = order.indexOf(id); if (i >= 0) order.splice(i, 1);
  }
  const evict = () => { for (let i = 0; order.length > KEEP && i < order.length; ) { if (states[order[i]] === CARD) { i++; continue; } releaseCard(order[i]); } };
  const ensure = (id) => {
    if (states[id]) { touch(id); return Promise.resolve(states[id]); }
    return pending[id] || (pending[id] = prepareCard(id, hashSeed(id)).then((st) => { touch(id); evict(); return st; }).finally(() => delete pending[id]));
  };
  const CROP = { x: 0.075, w: 0.85 };                                       // the card's box inside the canvas (the game's card is 5 : 7.4)
  function cropToCard(w = 336) {
    const cw = canvas.width * CROP.w, ch = cw / (5 / 7.4), cx = canvas.width * CROP.x, cy = (canvas.height - ch) / 2;
    const out = document.createElement("canvas"); out.width = w; out.height = Math.round(w / (5 / 7.4)); out.getContext("2d").drawImage(canvas, cx, cy, cw, ch, 0, 0, out.width, out.height);
    return out;
  }
  // size the canvas so the card's box is `cardPx` device pixels wide
  function fit(cardPx) { cardPx = Math.max(96, Math.round(cardPx)); const cw = Math.round(cardPx / 0.85); if (Math.abs(cw - CW) > 1) { CW = cw; CH = Math.round(cw * 800 / 560); sizeCanvas(); } }
  const host = {
    ensure: (id) => ensure(id).then(() => true),
    ready: (id) => !!states[id],
    // the card face-on, in a canvas `cardPx` wide; rendered now, so only call it on a canvas that is not showing a live card
    async still(id, over, cardPx) {
      await ensure(id); fit(cardPx); selectCard(id, { ov: over }); pose.ay = pose.ax = pose.ty = pose.tx = pose.vx = pose.vy = 0; render(0.4); return cropToCard(cardPx);
    },
    async show(id, over, cardPx) {
      await ensure(id); fit(cardPx); P.paused = false; selectCard(id, { ov: over }); pose.ay = pose.ax = pose.ty = pose.tx = pose.vx = pose.vy = 0; lastMove = performance.now(); invalidate(); return true;
    },
    // how the rules lay out on the card's face: every character placed, in how many lines, at what size (card widths / 100)
    async rules(id) {
      await ensure(id);
      const d = states[id].d, text = d.text || "", L = layoutRules(document.createElement("canvas").getContext("2d"), text, d.type !== "spell");
      return { lines: L.lines.length, placed: L.lines.reduce((a, l) => a + l.cs.length, 0), total: styled(text).length, size: L.fs / cq };
    },
    resize: fit,
    aim,
    rest() { pose.tx = pose.ty = 0; lastMove = performance.now() - 1500; invalidate(); },
    start() { P.paused = false; invalidate(); if (!running) { running = true; requestAnimationFrame(step); } },
    stop() { P.paused = true; running = false; },
    release(id) { releaseCard(id); },
    angles: () => ({ x: pose.ax, y: pose.ay }),
    current: () => CARD && CARD.id,
    perf: () => ({ gpuAvg, qscale, draws: drawn, w: canvas.width, h: canvas.height }),
    // review: hold a pose (radians about y and x)
    setPose(ay, ax) { pose.ay = pose.ty = ay; pose.ax = pose.tx = ax; pose.vx = pose.vy = 0; invalidate(); },
    redraw: invalidate,
  };

  /* --------------------------------------------------------------------- loop */
  // Render on demand: a card that is not moving does not redraw (a slow 6 Hz refresh keeps the motes twinkling).
  const BUDGET = 8;                       // GPU ms the card may spend per frame before the resolution drops
  let lastDraw = -1e9, lastAy = 1e9, lastAx = 1e9, drawsSec = 0, drawsShown = 0, tShown = performance.now(), drawn = 0;
  function pollQueries() {
    while (gpuQ.length) {
      const e = gpuQ[0];
      if (!gl.getQueryParameter(e, gl.QUERY_RESULT_AVAILABLE)) break;
      gpuQ.shift();
      const ms = gl.getQueryParameter(e, gl.QUERY_RESULT) / 1e6;
      if (!gl.getParameter(tExt.GPU_DISJOINT_EXT)) gpuAvg = gpuAvg == null ? ms : gpuAvg * 0.9 + ms * 0.1;
      gl.deleteQuery(e);
    }
  }
  function adapt() {
    if (gpuAvg == null || drawn % 24 !== 0) return;
    if (gpuAvg > BUDGET * 1.15 && qscale > 0.56) { qscale = Math.max(0.55, qscale - 0.08); sizeCanvas(); gpuAvg = null; }
    else if (gpuAvg < BUDGET * 0.55 && qscale < 1) { qscale = Math.min(1, qscale + 0.04); sizeCanvas(); gpuAvg = null; }
  }
  function step(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    const idle = now - lastMove > 2500 && !dragging;
    if (!frozen) {
      if (idle && P.sway) { const t = now / 1000; pose.ty = 0.34 * P.range * Math.sin(t * 0.85); pose.tx = 0.10 * P.range * Math.sin(t * 0.6 + 1.1); }
      else if (idle) { pose.tx = pose.ty = 0; }
    }
    const k = dragging ? 16 : 9, damp = 0.78;
    for (const [a, t, v] of [["ay", "ty", "vy"], ["ax", "tx", "vx"]]) { pose[v] += (pose[t] - pose[a]) * k * k * dt; pose[v] *= Math.pow(damp, dt * 60); pose[a] += pose[v] * dt; }
    const moving = Math.abs(pose.ay - lastAy) + Math.abs(pose.ax - lastAx) > 2e-4 || Math.abs(pose.vx) + Math.abs(pose.vy) > 2e-3;
    if (!P.paused && (!P.eco || dirty || moving || now - lastDraw > 160)) {
      let q0 = null;
      if (tExt && !gl.getQuery(tExt.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) { q0 = gl.createQuery(); gl.beginQuery(tExt.TIME_ELAPSED_EXT, q0); }
      render(now / 1000);
      if (q0) { gl.endQuery(tExt.TIME_ELAPSED_EXT); gpuQ.push(q0); }
      lastDraw = now; lastAy = pose.ay; lastAx = pose.ax; dirty = false; drawn++; drawsSec++;
      adapt();
    }
    if (tExt) pollQueries();
    if (running) requestAnimationFrame(step);
  }
  let running = false;
  return host;
  }
  return Object.freeze({ create });
})();
