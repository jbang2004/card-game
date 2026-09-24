/* Vesper (ranger hero) battle miniature: a hand-built chibi figure on a plinth —
 * toon parts on a joint hierarchy, two-bone IK arms and legs, verlet cloak,
 * spring hair, painted expressions, bow / arrow / charge effects. Presentation
 * only; built on the vendored three.js bundle (EmberVesperThree). Units are
 * metres, +Z faces the camera; she shoots toward +X / the `aim` point.
 * Prototype source: tools/.scratch/vesper3d/chibi.js (not versioned). */
const EmberVesperModel = (() => {
const THREE = EmberVesperThree;
const { mergeGeometries, mergeVertices } = THREE;
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// Chibi figure: body scale K, head scale HS, stubby legs and arms; stands on a base
const K = 0.62, HS = 3.02, LEG = 0.62, ARM = 0.74, BASE = 0.06, HAIRLEN = 0.36;
let OLS = 1;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeOut = (t, p = 3) => 1 - Math.pow(1 - clamp(t, 0, 1), p);
const easeInOut = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

// ------------------------------------------------------------------ palette
const C = {
  skin: 0xeac3a6, hair: 0x2f1e15, hairHi: 0x5a3a24, skinShade: 0xd7a386, glove: 0x5a3a25,
  cloak: 0x1f4027, cloakIn: 0x132a1a, tunic: 0x2b4d2c, shirt: 0x4a4a42,
  leather: 0x4f3020, leatherDk: 0x2c1a12, trousers: 0x23261f, boot: 0x3a2418, scarf: 0x5e1519, gold: 0xc9a352,
  wood: 0x6b4325, woodDk: 0x4b2d17, metal: 0xc4bcac, bronze: 0xa98145, leaf: 0x6d9a3f, ink: 0x1b120d,
};

// ------------------------------------------------------------------ canvas textures
function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat, opts.repeat); }
  return t;
}
function speckle(g, w, h, n, colors, size = [1, 3], alpha = [0.05, 0.18]) {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = rand(alpha[0], alpha[1]); g.fillStyle = colors[(Math.random() * colors.length) | 0];
    const s = rand(size[0], size[1]); g.fillRect(Math.random() * w, Math.random() * h, s, s * rand(1, 3));
  }
  g.globalAlpha = 1;
}
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

// Face painted in head-local metres: canvas covers x -0.1..0.1, y +0.08..-0.14 of the
// (undeformed-scale) head, projected straight onto the front of the head.
const FACE_BOX = { x0: -0.1, x1: 0.1, y0: 0.08, y1: -0.14 };
const FACE_W = 1024, FACE_H = Math.round(1024 * (FACE_BOX.y0 - FACE_BOX.y1) / (FACE_BOX.x1 - FACE_BOX.x0));
// chibi face: big glossy anime eyes, short soft brows, dot nose, small mouth
// Vesper is a cool, quiet ranger: sharp slanted eyes, straight low brows, small
// asymmetric mouth. expr: open, closed, focus, shout, hurt, joy (confident wink)
function faceTexture(expr) {
  if (expr === true) expr = 'closed'; if (!expr) expr = 'open';
  return canvasTex(FACE_W, FACE_H, (g, W, H) => {
    const sx = W / (FACE_BOX.x1 - FACE_BOX.x0);
    const X = (x) => (x - FACE_BOX.x0) * sx, Y = (y) => (FACE_BOX.y0 - y) * sx, L = (m) => m * sx;
    g.fillStyle = hex(C.skin); g.fillRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const soft = (x, y, rx, ry, col, a0) => {
      g.save(); g.translate(X(x), Y(y)); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, L(rx)); gr.addColorStop(0, col.replace('A', a0)); gr.addColorStop(1, col.replace('A', 0));
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, L(rx), 0, TAU); g.fill(); g.restore();
    };
    const fr = g.createLinearGradient(0, Y(0.06), 0, Y(0.022)); fr.addColorStop(0, 'rgba(150,80,58,.45)'); fr.addColorStop(1, 'rgba(150,80,58,0)');
    g.fillStyle = fr; g.fillRect(0, 0, W, Y(0.022));
    const ink = '#22140c';
    // per-eye settings: lid (0 open .. 1 shut), brow tilt/raise, closed style
    const E = {
      open: { lid: [0.18, 0.18], brow: [0.3, 0.3], y: [0, 0] },
      closed: { shut: [1, 1], brow: [0.3, 0.3], y: [0, 0] },
      focus: { lid: [0.46, 0.46], brow: [0.62, 0.62], y: [-0.004, -0.004] },
      shout: { lid: [0.05, 0.05], brow: [0.8, 0.8], y: [-0.002, -0.002] },
      hurt: { lid: [0.5, 0], shut: [0, 1], brow: [-0.5, -0.6], y: [0.002, 0.004] },
      joy: { lid: [0.2, 0], shut: [0, 1], brow: [0.15, -0.1], y: [0.003, 0.006] },
    }[expr];
    [-1, 1].forEach((s, i) => {
      const cx = s * 0.036, cy = -0.017;
      soft(s * 0.049, -0.049, 0.015, 0.007, 'rgba(235,125,110,A)', expr === 'hurt' ? 0.25 : 0.3);
      // brow: straight blade, inner end pulled down by E.brow (negative = worried)
      const bt = E.brow[i], by = 0.021 + E.y[i];
      g.fillStyle = ink; g.beginPath();
      g.moveTo(X(s * 0.014), Y(by - 0.006 * bt)); g.lineTo(X(s * 0.058), Y(by + 0.004 + 0.003 * bt));
      g.lineTo(X(s * 0.057), Y(by + 0.0015 + 0.003 * bt)); g.lineTo(X(s * 0.015), Y(by - 0.008 * bt - 0.002)); g.closePath(); g.fill();
      const shut = E.shut ? E.shut[i] : 0;
      if (shut) {
        g.strokeStyle = ink; g.lineWidth = L(0.0036);
        if (expr === 'joy') { // wink: a clean hooked line
          g.beginPath(); g.moveTo(X(cx - s * 0.019), Y(cy + 0.002)); g.quadraticCurveTo(X(cx), Y(cy + 0.012), X(cx + s * 0.021), Y(cy + 0.001)); g.stroke();
          g.lineWidth = L(0.0022); g.beginPath(); g.moveTo(X(cx + s * 0.021), Y(cy + 0.001)); g.lineTo(X(cx + s * 0.027), Y(cy + 0.007)); g.stroke();
        } else if (expr === 'hurt') { // squeezed shut with creases
          g.beginPath(); g.moveTo(X(cx - s * 0.019), Y(cy + 0.004)); g.lineTo(X(cx + s * 0.02), Y(cy - 0.002)); g.stroke();
          g.lineWidth = L(0.0014); for (const d of [-0.007, 0, 0.007]) { g.beginPath(); g.moveTo(X(cx + s * (0.024 + 0.002)), Y(cy + d)); g.lineTo(X(cx + s * 0.031), Y(cy + d * 1.4)); g.stroke(); }
        } else {
          g.beginPath(); g.moveTo(X(cx - s * 0.02), Y(cy + 0.001)); g.quadraticCurveTo(X(cx), Y(cy - 0.006), X(cx + s * 0.022), Y(cy + 0.003)); g.stroke();
        }
        return;
      }
      const lid = E.lid[i];
      // almond eye: flat, slanted upper lid, rounded lower lid
      const eyeP = () => { g.beginPath(); g.moveTo(X(cx - s * 0.02), Y(cy + 0.004)); g.quadraticCurveTo(X(cx - s * 0.004), Y(cy + 0.03), X(cx + s * 0.023), Y(cy + 0.013)); g.quadraticCurveTo(X(cx + s * 0.016), Y(cy - 0.03), X(cx - s * 0.02), Y(cy + 0.004)); g.closePath(); };
      g.fillStyle = '#f6f1e8'; eyeP(); g.fill();
      g.save(); eyeP(); g.clip();
      const ix = X(cx + s * 0.002), iy = Y(cy - 0.002);
      const gr = g.createLinearGradient(0, iy - L(0.018), 0, iy + L(0.018));
      gr.addColorStop(0, '#2f2a0c'); gr.addColorStop(0.5, '#7c7524'); gr.addColorStop(1, '#d6c25a');
      g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, L(0.0135), L(0.018), 0, 0, TAU); g.fill();
      g.fillStyle = '#140d05'; g.beginPath(); g.ellipse(ix, iy - L(0.001), L(0.0045), L(0.0085), 0, 0, TAU); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ix - s * L(0.004), iy - L(0.007), L(0.0035), L(0.0042), 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(ix + s * L(0.005), iy + L(0.008), L(0.0015), 0, TAU); g.fill();
      // heavy lid: skin comes down along the slant, its edge is the lash line
      const lidY = cy + 0.024 - 0.042 * lid;
      g.fillStyle = hex(C.skin); g.beginPath(); g.moveTo(X(cx - s * 0.03), Y(cy + 0.03)); g.lineTo(X(cx + s * 0.03), Y(cy + 0.03));
      g.lineTo(X(cx + s * 0.03), Y(lidY - 0.006)); g.lineTo(X(cx - s * 0.03), Y(lidY + 0.004)); g.closePath(); g.fill();
      const sh = g.createLinearGradient(0, Y(lidY + 0.001), 0, Y(lidY - 0.008)); sh.addColorStop(0, 'rgba(50,25,15,.55)'); sh.addColorStop(1, 'rgba(50,25,15,0)');
      g.fillStyle = sh; g.fillRect(X(cx - 0.03), Y(lidY + 0.002), L(0.06), L(0.012));
      g.restore();
      // lash line: thick, sharp flick at the outer corner
      g.fillStyle = ink; g.beginPath();
      const ly = Math.min(lidY, cy + 0.0195);
      g.moveTo(X(cx - s * 0.021), Y(Math.min(cy + 0.003, ly - 0.001)));
      g.quadraticCurveTo(X(cx), Y(ly + 0.0045), X(cx + s * 0.024), Y(ly - 0.002));
      g.lineTo(X(cx + s * 0.032), Y(ly + 0.004));
      g.lineTo(X(cx + s * 0.021), Y(ly - 0.0065));
      g.quadraticCurveTo(X(cx), Y(ly - 0.001), X(cx - s * 0.019), Y(Math.min(cy + 0.0005, ly - 0.004)));
      g.closePath(); g.fill();
      g.strokeStyle = 'rgba(70,40,28,.75)'; g.lineWidth = L(0.001);
      g.beginPath(); g.moveTo(X(cx + s * 0.004), Y(cy - 0.0125)); g.quadraticCurveTo(X(cx + s * 0.014), Y(cy - 0.011), X(cx + s * 0.019), Y(cy - 0.003)); g.stroke();
    });
    // nose: a small shadow tick
    g.strokeStyle = 'rgba(160,90,70,.7)'; g.lineWidth = L(0.0014);
    g.beginPath(); g.moveTo(X(0.002), Y(-0.042)); g.lineTo(X(-0.001), Y(-0.047)); g.stroke();
    // mouth
    g.strokeStyle = '#6e332b'; g.lineWidth = L(0.002);
    if (expr === 'shout') {
      g.fillStyle = '#5a221d'; g.beginPath(); g.moveTo(X(-0.009), Y(-0.061)); g.lineTo(X(0.01), Y(-0.059)); g.quadraticCurveTo(X(0.006), Y(-0.072), X(-0.001), Y(-0.071)); g.quadraticCurveTo(X(-0.007), Y(-0.069), X(-0.009), Y(-0.061)); g.fill(); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(X(-0.008), Y(-0.0615)); g.lineTo(X(0.0095), Y(-0.0595)); g.lineTo(X(0.008), Y(-0.063)); g.lineTo(X(-0.007), Y(-0.064)); g.fill();
    } else if (expr === 'hurt') {
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect(X(-0.009), Y(-0.06), L(0.018), L(0.007), L(0.002)); g.fill(); g.stroke();
      g.lineWidth = L(0.0008); g.beginPath(); g.moveTo(X(-0.009), Y(-0.0635)); g.lineTo(X(0.009), Y(-0.0635)); for (const x of [-0.004, 0, 0.004]) { g.moveTo(X(x), Y(-0.06)); g.lineTo(X(x), Y(-0.067)); } g.stroke();
      g.fillStyle = 'rgba(150,200,255,.85)'; g.beginPath(); g.moveTo(X(0.068), Y(0.032)); g.quadraticCurveTo(X(0.078), Y(0.014), X(0.073), Y(0.008)); g.quadraticCurveTo(X(0.064), Y(0.01), X(0.068), Y(0.032)); g.fill();
    } else if (expr === 'joy') { // smirk with a glint of tooth
      g.beginPath(); g.moveTo(X(-0.008), Y(-0.064)); g.quadraticCurveTo(X(0.002), Y(-0.067), X(0.011), Y(-0.058)); g.stroke();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(X(0.004), Y(-0.0645)); g.lineTo(X(0.0095), Y(-0.0595)); g.lineTo(X(0.007), Y(-0.0655)); g.fill();
    } else if (expr === 'focus') {
      g.beginPath(); g.moveTo(X(-0.006), Y(-0.0645)); g.lineTo(X(0.006), Y(-0.0635)); g.stroke();
    } else { // calm, one corner slightly up
      g.beginPath(); g.moveTo(X(-0.007), Y(-0.0645)); g.quadraticCurveTo(X(0.002), Y(-0.066), X(0.008), Y(-0.062)); g.stroke();
    }
  });
}
const cloakAlpha = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#000';
  for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, h); g.quadraticCurveTo(x + 16, h - 34 - (x % 64 ? 0 : 14), x + 32, h); g.closePath(); g.fill(); }
});
const cloakTex = () => canvasTex(512, 512, (g, w, h) => {
  { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2c5530'); gr.addColorStop(0.55, hex(C.cloak)); gr.addColorStop(1, '#10261a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  speckle(g, w, h, 5000, ['#16301c', '#355f3a', '#23462a'], [1, 2], [0.1, 0.3]);
  for (let x = 0; x < w; x += 6) { g.globalAlpha = 0.06; g.fillStyle = '#1f3a1b'; g.fillRect(x, 0, 2, h); }
  for (let k = 0; k < 11; k++) {
    const x = (k + 0.5) * w / 11, gr = g.createLinearGradient(x - 22, 0, x + 22, 0);
    gr.addColorStop(0, 'rgba(15,35,14,0)'); gr.addColorStop(0.5, 'rgba(15,35,14,.35)'); gr.addColorStop(1, 'rgba(15,35,14,0)');
    g.globalAlpha = 1; g.fillStyle = gr; g.beginPath(); g.moveTo(x - 6, 0); g.lineTo(x + 6, 0); g.lineTo(x + 22, h); g.lineTo(x - 22, h); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(120,170,95,.18)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 14, h * 0.1); g.lineTo(x + 26, h); g.stroke();
  }
  g.globalAlpha = 1;
  // embroidered vine band above the hem
  g.strokeStyle = 'rgba(201,163,82,.8)'; g.lineWidth = 3;
  g.beginPath(); for (let x = 0; x <= w; x += 4) g.lineTo(x, h - 70 + 9 * Math.sin(x / 18)); g.stroke();
  g.fillStyle = 'rgba(201,163,82,.85)';
  for (let x = 12; x < w; x += 36) { const y = h - 70 + 9 * Math.sin(x / 18); for (const d of [-1, 1]) { g.save(); g.translate(x, y); g.rotate(d * 0.8); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(5, d * 8, 0, d * 16); g.quadraticCurveTo(-5, d * 8, 0, 0); g.fill(); g.restore(); } }
  g.strokeStyle = '#c9a352'; g.lineWidth = 5;
  g.strokeRect(10, -20, w - 20, h - 10 + 20); // trim along the sides and hem (v=0 is the hem)
  g.strokeStyle = '#27461f'; g.lineWidth = 2; g.strokeRect(20, -20, w - 40, h - 20 + 20);
});
const tunicTex = (v = true) => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = hex(C.tunic); g.fillRect(0, 0, w, h);
  speckle(g, w, h, 4000, ['#3e6331', '#6a9454', '#4a7239'], [1, 2], [0.1, 0.25]);
  if (!v) return;
  // front V opening shows the linen shirt (front = u 0.5, top = v 1)
  g.fillStyle = hex(C.shirt);
  g.beginPath(); g.moveTo(w * 0.5 - 52, 0); g.lineTo(w * 0.5 + 52, 0); g.lineTo(w * 0.5 + 5, h * 0.42); g.lineTo(w * 0.5 - 5, h * 0.42); g.closePath(); g.fill();
  speckle(g, w, h * 0.55, 300, ['#d4c29e'], [1, 2], [0.2, 0.4]);
  g.strokeStyle = '#c9a352'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(w * 0.5 - 56, 0); g.lineTo(w * 0.5 - 7, h * 0.43); g.moveTo(w * 0.5 + 56, 0); g.lineTo(w * 0.5 + 7, h * 0.43); g.stroke();
});
const bracerTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = hex(C.leather); g.fillRect(0, 0, w, h);
  speckle(g, w, h, 1500, ['#4a2b19', '#8a5a3a'], [1, 2], [0.1, 0.3]);
  g.strokeStyle = '#3d2314'; g.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    const x0 = (k + 0.5) * w / 4;
    g.beginPath(); g.moveTo(x0, 10); g.bezierCurveTo(x0 + 25, 80, x0 - 25, 150, x0, 246); g.stroke();
    for (let j = 0; j < 4; j++) { const y = 40 + j * 55; g.beginPath(); g.ellipse(x0 + (j % 2 ? 12 : -12), y, 10, 5, j % 2 ? 0.6 : -0.6, 0, TAU); g.stroke(); }
  }
});
const foldTex = (base, dark, light, n = 7, stitch = null) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = hex(base); g.fillRect(0, 0, w, h);
  speckle(g, w, h, 1200, [dark, light], [1, 2], [0.08, 0.2]);
  for (let i = 0; i < n; i++) {
    const x = rand(0, w), len = rand(h * 0.3, h * 0.8), y = rand(0, h - len);
    const gr = g.createLinearGradient(x - 10, 0, x + 10, 0); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, dark); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = 0.35; g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + rand(-12, 12), y + len / 2, x + rand(-6, 6), y + len); g.lineTo(x + 8, y + len); g.quadraticCurveTo(x + 10, y + len / 2, x + 6, y); g.fill();
    g.globalAlpha = 0.25; g.strokeStyle = light; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 9, y + 6); g.lineTo(x + 9 + rand(-4, 4), y + len - 6); g.stroke();
  }
  g.globalAlpha = 1;
  if (stitch) { g.strokeStyle = stitch; g.lineWidth = 2; g.setLineDash([6, 5]); for (const y of [10, h - 12]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } g.setLineDash([]); }
});
const glowTex = () => canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
});
const leafTex = () => canvasTex(64, 64, (g) => {
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(32, 2); g.quadraticCurveTo(62, 30, 32, 62); g.quadraticCurveTo(2, 30, 32, 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(32, 6); g.lineTo(32, 60); g.stroke();
});

// ------------------------------------------------------------------ materials
function toonRamp() {
  const d = new Uint8Array([120, 175, 225, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
const RAMP = toonRamp();
const U_HIT = { value: 0 }, U_NOHIT = { value: 0 };
let CHAR_BUILD = false;
const RIM_GLSL = `
  outgoingLight = mix(outgoingLight, vec3(1.25, 0.6, 1.15), uHit * 0.25);
  float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  outgoingLight += vec3(1.0, 0.9, 0.72) * rimF * 0.22;
  outgoingLight *= 0.93 + 0.12 * normalize(normal).y;
  { vec3 hv = normalize(normalize(vViewPosition) + vec3(0.3, 0.6, 0.4)); float sp = pow(max(dot(normalize(normal), hv), 0.0), 24.0); outgoingLight += vec3(1.0, 0.97, 0.9) * smoothstep(0.55, 0.7, sp) * 0.12; }
`;
const HAIR_GLSL = `
  float hb = dot(normalize(normal), normalize(vec3(0.0, 0.78, 0.62)));
  float band = smoothstep(0.84, 0.87, hb) * (1.0 - smoothstep(0.93, 0.96, hb));
  outgoingLight += vec3(0.22, 0.15, 0.1) * band;
`;
function patchFrag(s, extra, hit = U_HIT) { s.uniforms.uHit = hit; s.fragmentShader = 'uniform float uHit;\n' + s.fragmentShader.replace('#include <opaque_fragment>', extra + '\n#include <opaque_fragment>'); }
const toon = (color, extra = {}, rim = true) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP, ...extra });
  if (rim) { const hit = CHAR_BUILD ? U_HIT : U_NOHIT; m.onBeforeCompile = (s) => patchFrag(s, RIM_GLSL, hit); m.customProgramCacheKey = () => 'rim' + (CHAR_BUILD ? 'c' : ''); }
  return m;
};
const hairToon = (color, extra = {}) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP, ...extra });
  m.onBeforeCompile = (s) => patchFrag(s, HAIR_GLSL); m.customProgramCacheKey = () => 'hairsheen';
  return m;
};
const outlineCache = new Map();
function outlineMat(w) {
  const key = w.toFixed(4);
  if (outlineCache.has(key)) return outlineCache.get(key);
  const m = new THREE.MeshBasicMaterial({ color: 0x3a2014, side: THREE.BackSide });
  m.onBeforeCompile = (s) => { s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${key};`); };
  m.customProgramCacheKey = () => 'outline' + key;
  outlineCache.set(key, m); return m;
}
function mesh(geo, mat, parent, o = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (o.pos) m.position.set(...o.pos);
  if (o.rot) m.rotation.set(...o.rot);
  m.castShadow = o.shadow !== false; m.receiveShadow = !!o.receive;
  if (o.outline) m.add(new THREE.Mesh(geo, outlineMat(o.outline * OLS)));
  parent.add(m); return m;
}
function joint(parent, x, y, z, name) { const j = new THREE.Object3D(); j.position.set(x, y, z); j.name = name || ''; parent.add(j); return j; }

// ------------------------------------------------------------------ geometry helpers
function lathe(profile, { seg = 40, zs = 1, xs = 1, uv = false } = {}) {
  // LatheGeometry faces outward only when the profile runs upward
  if (profile[profile.length - 1][1] < profile[0][1]) profile = profile.slice().reverse();
  let g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, Math.PI);
  g.scale(xs, 1, zs);
  if (!uv) { g.deleteAttribute('uv'); g = mergeVertices(g); }
  g.computeVertexNormals(); return g;
}
function smooth(g) { g.deleteAttribute('uv'); g = mergeVertices(g); g.computeVertexNormals(); return g; }
// Ribbon / tapered strip along points; `up(p, t)` gives the surface normal the
// strip lies on; width and thickness may vary along it.
function ribbon(points, { segs = 24, width = () => 0.02, thick = () => 0.004, up, radial = 8, closed = false, crescent = 0, root = 0 }) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const pos = [], idx = [], huv = [];
  const n = segs;
  for (let i = 0; i <= n; i++) {
    const t = i / n, P = curve.getPointAt(closed ? t % 1 : t), T = curve.getTangentAt(closed ? t % 1 : t).normalize();
    let N = up(P, t).clone(); const B = V3().crossVectors(T, N).normalize(); N = V3().crossVectors(B, T).normalize();
    const rk = root > 0 ? 0.08 + 0.92 * sstep(0, root, t) : 1;
    const w = width(t) * rk, th = thick(t) * rk;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * TAU;
      const p = P.clone().addScaledVector(N, Math.cos(a) * th - crescent * w * 0.32 * Math.sin(a) ** 2).addScaledVector(B, Math.sin(a) * w);
      pos.push(p.x, p.y, p.z); huv.push(j / radial, t);
    }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('hairUv', new THREE.Float32BufferAttribute(huv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function quatFromBasis(x, y, z) { return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)); }

// ------------------------------------------------------------------ the character
function buildVesper(scene) {
  const J = {};
  const rig = new THREE.Group(); scene.add(rig); rig.scale.setScalar(K); rig.position.y = BASE;
  J.root = joint(rig, 0, 0.645, 0, 'root');
  const OL = 0.0075;

  // pelvis, trousers seat
  mesh(lathe([[0, -0.13], [0.12, -0.12], [0.15, -0.05], [0.152, 0.05], [0.14, 0.12], [0, 0.12]], { zs: 0.74 }), toon(C.trousers), J.root, { outline: OL });
  // tunic skirt panels (they follow the thighs)
  const skirt = [];
  const skirtMat = toon(C.tunic, { side: THREE.DoubleSide, map: null });
  for (const [a0, a1, leg] of [[0.1, 1.5, 'L'], [-1.5, -0.1, 'R'], [1.6, 3.05, 'L'], [-3.05, -1.6, 'R']]) {
    const piv = joint(J.root, 0, 0.02, 0);
    const g = new THREE.CylinderGeometry(0.158, 0.215, 0.4, 16, 6, true, a0, a1 - a0);
    g.translate(0, -0.2, 0); g.scale(1, 1, 0.78);
    // soft wave in the hem
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const ang = Math.atan2(p.getX(i), p.getZ(i)); p.setY(i, y + (y < -0.3 ? 0.012 * Math.sin(ang * 9) : 0)); }
    g.computeVertexNormals();
    mesh(g, skirtMat, piv, { outline: 0.003 });
    skirt.push({ piv, leg, back: Math.abs(a0) > 1.55 });
  }
  // belts: two crossing ribbons around the waist, buckle, pouch
  const beltMat = toon(C.leather), metalMat = toon(C.metal), bronzeMat = toon(C.bronze);
  const waist = (y, tilt, rx = 0.162, rz = 0.125) => {
    const pts = []; for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; pts.push(V3(Math.sin(a) * rx, y + Math.sin(a) * tilt, Math.cos(a) * rz)); }
    return pts;
  };
  const outward = (p) => V3(p.x, 0, p.z / 0.6).normalize();
  mesh(ribbon(waist(0.04, 0.0), { closed: true, segs: 48, width: () => 0.022, thick: () => 0.006, up: outward }), beltMat, J.root, { outline: 0.003 });
  mesh(ribbon(waist(-0.01, 0.035, 0.168, 0.132), { closed: true, segs: 48, width: () => 0.018, thick: () => 0.006, up: outward }), toon(C.leatherDk), J.root, { outline: 0.003 });
  mesh(new THREE.TorusGeometry(0.022, 0.0055, 8, 20), metalMat, J.root, { pos: [0, 0.04, 0.132], outline: 0.002 });
  mesh(smooth(new THREE.BoxGeometry(0.07, 0.08, 0.035, 2, 2, 2)), beltMat, J.root, { pos: [0.13, -0.03, 0.08], rot: [0, 0.9, 0], outline: 0.003 });

  // quiver on the right hip, arrows sticking up
  const quiver = joint(J.root, -0.17, 0.0, -0.07);
  quiver.rotation.set(0.35, 0, -0.28);
  mesh(lathe([[0, -0.22], [0.04, -0.21], [0.046, -0.1], [0.05, 0.16], [0.052, 0.19], [0.044, 0.19], [0.04, -0.2]], { seg: 20 }), toon(C.leather, { side: THREE.DoubleSide }), quiver, { outline: 0.003 });
  for (const y of [-0.12, 0.12]) mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 20), toon(C.leatherDk), quiver, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
  const quiverArrows = [];
  for (let i = 0; i < 5; i++) {
    const a = makeArrow(true);
    a.scale.setScalar(0.85);
    a.position.set(Math.cos(i * 1.3) * 0.018, 0.4 + rand(-0.02, 0.02), Math.sin(i * 1.3) * 0.018);
    a.rotation.set(rand(-0.06, 0.06), 0, -Math.PI / 2 + rand(-0.06, 0.06)); // arrow +X (tip) points down into the quiver
    quiver.add(a); quiverArrows.push(a);
  }

  // legs
  const trouserMat = toon(0xffffff, { map: foldTex(C.trousers, '#18231a', '#465a3a', 8) }), bootMat = toon(0xffffff, { map: foldTex(C.boot, '#3a2212', '#7a5134', 5, 'rgba(230,200,150,.55)') }), bootPlain = toon(C.boot);
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const hip = J['hip' + L] = joint(J.root, s * 0.09, -0.06, 0);
    mesh(lathe([[0, 0.03], [0.09, 0.01], [0.092, -0.08], [0.082, -0.22], [0.068, -0.36], [0.06, -0.43], [0, -0.44]], { zs: 0.95, uv: true }), trouserMat, hip, { outline: OL }).scale.y = LEG;
    const knee = J['kn' + L] = joint(hip, 0, -0.43 * LEG, 0);
    mesh(lathe([[0, 0.03], [0.064, 0.02], [0.068, -0.04], [0.071, -0.12], [0.059, -0.26], [0.049, -0.36], [0.052, -0.4], [0, -0.41]], { uv: true }), bootMat, knee, { outline: OL }).scale.set(1.12, LEG, 1.12);
    for (const y of [-0.17 * LEG, -0.3 * LEG]) mesh(ribbon(Array.from({ length: 13 }, (_, i) => { const a = i / 12 * TAU; const r = y > -0.2 ? 0.068 : 0.056; return V3(Math.sin(a) * r, y + 0.012 * Math.sin(a), Math.cos(a) * r); }), { closed: true, segs: 36, width: () => 0.009, thick: () => 0.003, up: (p) => V3(p.x, 0, p.z).normalize() }), toon(C.leatherDk), knee, { outline: 0.002 });
    mesh(new THREE.TorusGeometry(0.009, 0.0025, 6, 12), toon(C.metal), knee, { pos: [s * 0.03, -0.17 * LEG, 0.06], rot: [0, s * 0.45, 0] });
    mesh(lathe([[0.056, 0.05], [0.074, 0.04], [0.076, -0.02], [0.07, -0.05], [0.056, -0.05]], { seg: 28 }), toon(C.leatherDk), knee, { outline: 0.003 });
    const ank = J['an' + L] = joint(knee, 0, -0.41 * LEG, 0);
    const fg = new THREE.CapsuleGeometry(0.046, 0.16, 6, 16); fg.rotateX(Math.PI / 2); fg.scale(0.95, 0.7, 1);
    mesh(new THREE.BoxGeometry(0.085, 0.014, 0.25), toon(0x241710), ank, { pos: [0, -0.084, 0.06], outline: 0.002 });
    mesh(fg, bootPlain, ank, { pos: [0, -0.052, 0.055], outline: OL });
  }

  // spine + chest
  J.spine = joint(J.root, 0, 0.1, 0);
  mesh(lathe([[0, -0.04], [0.138, -0.04], [0.128, 0.07], [0.14, 0.2], [0, 0.2]], { zs: 0.74, uv: true }), toon(0xffffff, { map: tunicTex(false) }), J.spine, { outline: OL });
  J.chest = joint(J.spine, 0, 0.18, 0);
  const chestG = lathe([[0, 0], [0.15, 0], [0.162, 0.08], [0.17, 0.16], [0.155, 0.22], [0.095, 0.265], [0, 0.275]], { zs: 0.7, uv: true });
  mesh(chestG, toon(0xffffff, { map: tunicTex() }), J.chest, { outline: OL });
  // cross straps over the chest (quiver strap + bandolier)
  const chestSurf = (p) => V3(p.x / 0.17, 0, p.z / 0.12).normalize();
  const strap = (a, b) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      const rx = 0.172, rz = 0.126; const z = rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)) + 0.004;
      pts.push(V3(x, y, z));
    }
    return pts;
  };
  mesh(ribbon(strap([-0.12, 0.23], [0.15, -0.12]), { segs: 20, width: () => 0.017, thick: () => 0.005, up: chestSurf }), beltMat, J.chest, { outline: 0.0025 });
  
  // neck + collar
  J.neck = joint(J.chest, 0, 0.27, 0);
  mesh(new THREE.CylinderGeometry(0.037, 0.045, 0.11, 20), toon(C.skinShade), J.neck, { pos: [0, 0.03, 0], outline: 0.003 });
  mesh(lathe([[0.05, 0.02], [0.07, -0.01], [0.09, -0.03], [0.05, -0.03]], { seg: 28 }), toon(C.shirt), J.neck, { outline: 0.003 });

  // head
  J.head = joint(J.neck, 0, 0.075, 0, 'head');
  const R = 0.108;
  const HC = V3(0, 0.3, 0.02);
  const deformHead = (v, k = 1) => {
    let { x, y, z } = v; const ny = y / (R * k);
    y *= 1.06;
    if (z > 0) z *= 0.9;
    if (ny < 0) {
      const q = Math.pow(-ny, 1.25);
      x *= 1 - 0.2 * q; z *= z < 0 ? 1 - 0.2 * q : 1 - 0.04 * q; y *= 1 - 0.06 * q;
      if (z > 0) z += 0.007 * q * k;
    }
    x *= 0.9 * (1 + 0.045 * Math.exp(-(((ny + 0.12) / 0.25) ** 2)));
    v.set(x, y, z);
  };
  // smooth, readable cel shading on the face: blend geometric and spherical normals
  const deformGeo = (g, k) => {
    const p = g.attributes.position, v = V3(), o = [];
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); o.push(v.clone().normalize()); deformHead(v, k); p.setXYZ(i, v.x, v.y, v.z); }
    g.computeVertexNormals();
    const n = g.attributes.normal, t = V3();
    for (let i = 0; i < n.count; i++) { t.fromBufferAttribute(n, i).multiplyScalar(0.55).addScaledVector(o[i], 0.45).normalize(); const f = Math.max(0, o[i].z) ** 2 * 0.55; t.lerp(V3(0, 0.15, 1).normalize(), f).normalize(); n.setXYZ(i, t.x, t.y, t.z); }
    return g;
  };
  const faceOpen = faceTexture(false), faceClosed = faceTexture(true);
  const faces = { focus: faceTexture('focus'), shout: faceTexture('shout'), hurt: faceTexture('hurt'), joy: faceTexture('joy') };
  const headG = deformGeo(new THREE.SphereGeometry(R, 64, 48), 1);
  { // planar projection of the painted face onto the front; the rest samples plain skin
    const p = headG.attributes.position, n = headG.attributes.normal, uv = headG.attributes.uv;
    const sw = FACE_BOX.x1 - FACE_BOX.x0, sh = FACE_BOX.y0 - FACE_BOX.y1;
    for (let i = 0; i < p.count; i++) {
      const front = n.getZ(i) > 0.05 && p.getZ(i) > 0;
      if (front) uv.setXY(i, (p.getX(i) - FACE_BOX.x0) / sw, 1 - (FACE_BOX.y0 - p.getY(i)) / sh);
      else uv.setXY(i, 0.02, 0.02);
    }
  }
  const skinMat = toon(0xffffff, { map: faceOpen });
  const faceMat = skinMat;
  OLS = 0.45;
  const headM = mesh(headG, skinMat, J.head, { pos: HC.toArray(), outline: 0.0035 });
  headM.scale.setScalar(HS);
  // nose ridge: a small wedge on the face
  { const d = V3(0, Math.sin(-0.46), Math.cos(-0.46)).multiplyScalar(R); deformHead(d, 1);
    const ng = new THREE.ConeGeometry(0.006, 0.03, 3); ng.rotateX(-0.28);
    mesh(ng, toon(C.skin), headM, { pos: [0, d.y + 0.008, d.z - 0.0025], rot: [0, Math.PI, 0] }); }
  // pointed elf ears
  const earShape = new THREE.Shape();
  earShape.moveTo(0, 0); earShape.quadraticCurveTo(0.026, 0.028, 0.01, 0.1); earShape.quadraticCurveTo(-0.012, 0.045, -0.014, 0.008); earShape.closePath();
  const earG = new THREE.ExtrudeGeometry(earShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10 });
  for (const s of [1, -1]) {
    const e = mesh(earG, toon(C.skin), headM, { pos: [s * R * 0.9, 0.0, -0.012], outline: 0.0025 }); e.scale.setScalar(0.72);
    const Y = V3(s * 0.5, 0.55, -0.67).normalize(), Z = V3(s * 0.85, 0, 0.5).normalize();
    const X = V3().crossVectors(Y, Z).normalize(); const Z2 = V3().crossVectors(X, Y);
    e.quaternion.copy(quatFromBasis(X, Y, Z2));
    const inner = new THREE.ShapeGeometry(earShape, 10); inner.scale(0.62, 0.7, 1); inner.translate(0.001, 0.012, 0);
    mesh(inner, toon(0xd49a86, { side: THREE.DoubleSide }), e, { pos: [0, 0, 0.0125] });
  }

  // hair: scalp cap, a draped back mass, wide long locks over it, bangs. The lower
  // hair follows the chest rather than the head (uCounter), and sways (uSway).
  const hairGroups = [];
  const hairU = { uCounter: { value: new THREE.Matrix3() }, uPivot: { value: V3(0, -0.12, -0.02) } };
  const hairMat = (sway, color = C.hair) => {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: RAMP, side: THREE.DoubleSide });
    m.onBeforeCompile = (s) => {
      s.uniforms.uSway = sway; s.uniforms.uCounter = hairU.uCounter; s.uniforms.uPivot = hairU.uPivot;
      s.vertexShader = 'uniform vec3 uSway; uniform mat3 uCounter; uniform vec3 uPivot;\nattribute vec2 hairUv; varying vec3 vHN; varying vec2 vHUv;\n' + s.vertexShader
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n float hkN = smoothstep(0.0, -0.14, position.y); objectNormal = normalize(mix(objectNormal, uCounter * objectNormal, hkN));`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float hk = smoothstep(0.0, -0.14, position.y);
          vec3 hv = normalize(position - vec3(0.0, 0.012, 0.0));
          hv = normalize(mix(hv, uCounter * hv, hk));
          vHN = normalize(normalMatrix * hv); vHUv = hairUv;
          transformed = mix(transformed, uPivot + uCounter * (transformed - uPivot), hk);
          float hs = smoothstep(0.0, -0.5, position.y); transformed += uSway * hs * hs;`);
      s.fragmentShader = 'varying vec3 vHN; varying vec2 vHUv;\n' + s.fragmentShader
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n vec3 hn = normalize(vHN); if (!gl_FrontFacing) hn = hn; normal = normalize(mix(normal, hn * (gl_FrontFacing ? 1.0 : 1.0), 0.62));`)
        .replace('#include <opaque_fragment>', `
          float hb = dot(hn, normalize(vec3(0.0, 0.74, 0.67)));
          float zz = 0.06 * abs(fract(vHUv.x * 3.0 + vHUv.y * 9.0) - 0.5);
          float band = smoothstep(0.86 + zz, 0.875 + zz, hb) * (1.0 - smoothstep(0.905 + zz, 0.925 + zz, hb));
          band *= 0.35 + 0.65 * smoothstep(0.2, 0.8, 0.5 + 0.5 * sin(vHUv.x * 6.2832 * 7.0 + vHUv.y * 5.0));
          outgoingLight += vec3(0.22, 0.16, 0.11) * band;
          outgoingLight *= mix(0.8, 1.1, clamp(vHUv.y, 0.0, 1.0));
          outgoingLight *= 1.0 - 0.22 * smoothstep(0.75, 1.0, abs(sin(6.2832 * vHUv.x)));
          outgoingLight *= 0.94 + 0.06 * sin(vHUv.x * 6.2832 * 5.0 + vHUv.y * 3.0);
          #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => 'hair2';
    return m;
  };
  const withHairUv = (g, uScale, vFn) => { const uv = g.attributes.uv, h = []; for (let i = 0; i < uv.count; i++) h.push(uv.getX(i) * uScale, vFn(uv.getY(i))); g.setAttribute('hairUv', new THREE.Float32BufferAttribute(h, 2)); return g; };
  const still = { value: V3() };
  const cap1 = withHairUv(deformGeo(new THREE.SphereGeometry(R * 1.075, 48, 28, 0, TAU, 0, 1.1), 1.075), 14, (v) => 0.1 + 0.4 * (1 - v));
  const cap2 = withHairUv(deformGeo(new THREE.SphereGeometry(R * 1.07, 48, 28, Math.PI / 2 + 1.25, TAU - 2.5, 0.9, 1.1), 1.07), 12, (v) => 0.1 + 0.5 * (1 - v));
  mesh(cap1, hairMat(still), headM, { outline: 0.004 });
  mesh(cap2, hairMat(still), headM);
  const onHead = (theta, phi, k = 1.07) => { const v = V3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)).multiplyScalar(R * k); deformHead(v, k); return v; };
  const awayFromHead = (p) => V3(p.x, p.y + 0.02, p.z).normalize();
  const BACK = Math.PI * 1.5; // phi pointing to -z
  // draped mass: from the scalp line down to mid back, narrowing to the back
  {
    const nu = 40, nv = 18, pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const v = j / nv, u = i / nu;
      const half = 1.6 - 0.55 * sstep(0.1, 0.7, v);
      const phi = BACK + (u * 2 - 1) * half;
      const top = onHead(0.5 + 0.35 * v, phi, 1.03);
      const y = top.y + 0.02 - v * (0.62 + 0.05 * Math.sin(u * 17)) * HAIRLEN * 1.5;
      const rTop = Math.hypot(top.x, top.z);
      const r = rTop * (1.02 - 0.12 * sstep(0.1, 1, v)) + 0.006 * Math.sin(u * 23) * v;
      const d = V3(-Math.cos(phi), 0, Math.sin(phi));
      const p = d.multiplyScalar(r); p.y = y;
      if (y < -0.12) p.z = Math.min(p.z, -0.05 - 0.02 * v);
      pos.push(p.x, p.y, p.z);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    { const h = []; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) h.push(i / nu * 9, 0.15 + 0.85 * j / nv); g.setAttribute('hairUv', new THREE.Float32BufferAttribute(h, 2)); }
    const sway = { value: V3() };
    mesh(g, hairMat(sway, 0x2e1c12), headM).name = 'mass';
    hairGroups.push({ key: 'M', sway, vel: V3(), off: V3() });
  }
  // long locks: wide flat locks over the mass
  const lockSets = { L: [], R: [], B: [] };
  const lockCount = 11;
  for (let i = 0; i < lockCount; i++) {
    const u = (i + rand(-0.3, 0.3)) / (lockCount - 1);
    const phi = BACK + (u * 2 - 1) * 1.38;
    const theta = rand(0.95, 1.2);
    const start = onHead(theta, phi, 1.08);
    const outDir = V3(start.x, 0, start.z - 0.06).normalize();
    const sideAmt = Math.abs(Math.cos(phi));
    const isSide = sideAmt > 0.8;
    const side = -Math.cos(phi) > 0 ? 'L' : 'R';
    const len = (isSide ? rand(0.36, 0.48) : rand(0.5, 0.66)) * HAIRLEN * 1.6;
    const pts = [start];
    const wavePh = rand(0, TAU), waveA = rand(0.01, 0.025);
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      const y = start.y + 0.015 - t * len;
      const r0 = Math.hypot(start.x, start.z);
      let r = r0 + 0.012 + 0.012 * sstep(0, 0.4, t) - 0.02 * sstep(0.5, 1, t);
      const p = outDir.clone().multiplyScalar(r); p.y = y;
      p.addScaledVector(V3(-outDir.z, 0, outDir.x), Math.sin(t * 6 + wavePh) * waveA * t);
      if (!isSide && y < -0.12) p.z = Math.min(p.z, -0.06 - 0.02 * t);
      pts.push(p);
    }
    const width0 = rand(0.1, 0.13);
    const upL = (p) => V3(p.x, 0, p.z).normalize();
    const g = ribbon(pts, { segs: 30, radial: 10, crescent: 0.8, width: (t) => width0 * (0.75 + 0.35 * Math.sin(Math.PI * Math.min(1, t * 1.3))) * (1 - t ** 1.8) + 0.0015, thick: (t) => 0.0055 * (1 - t) + 0.0012, up: upL , root: 0.3 });
    const set = isSide ? lockSets[side] : lockSets.B;
    set.push(g);
    const fine = pts.map((p, k) => p.clone().add(upL(p).multiplyScalar(0.006)).add(V3(0, 0, 0).addScaledVector(V3(-outDir.z, 0, outDir.x), Math.sin(k * 1.9 + wavePh) * 0.012)));
    if (false) set.push(ribbon(fine, { segs: 26, radial: 6, width: (t) => 0.006 * (1 - t ** 1.5) + 0.0008, thick: () => 0.0014, up: upL , root: 0.14 }));
  }
  // bangs: sweep from the crown over the forehead, parted to her right, face-framing locks
  const bangGeos = [];
  const bang = (phi0, theta0, end, width0, len = 1) => {
    const s = onHead(theta0, phi0, 1.07);
    const mid = onHead(0.9 + 0.25 * Math.min(len, 1.3), (phi0 + end[0]) / 2, 1.13);
    const e = onHead(end[1], end[0], 1.1);
    const pts = [s, mid, e];
    if (len > 1.2) { const low = e.clone(); low.y -= 0.13 * (len - 1); low.x *= 1.08; low.z -= 0.005; pts.push(low); }
    bangGeos.push(ribbon(pts, { segs: 16, radial: 6, width: (t) => width0 * (1 - 0.85 * t ** 1.2) + 0.0015, thick: () => 0.0045, up: awayFromHead , root: 0.14 }));
  };
  const F = Math.PI / 2;
  // front hair like the card: a part just left of centre, long wavy locks sweeping
  // down past the temples to the cheeks and jaw, two thin strands across the forehead
  const PART = F + 0.14;
  const frontLock = (side, k, n) => {
    const t0 = k / (n - 1);
    const pts = [
      onHead(0.16 + 0.05 * k, PART + side * 0.08, 1.07),
      onHead(0.62, PART + side * (0.4 + 0.22 * t0), 1.075),
      onHead(1.05, PART + side * (0.88 + 0.3 * t0), 1.06),
      onHead(1.5 + 0.1 * t0, PART + side * (1.25 + 0.25 * t0), 1.06),
    ];
    const low = onHead(1.95 + 0.15 * t0, PART + side * (1.38 + 0.25 * t0), 1.05); low.y -= 0.02 + 0.05 * t0; pts.push(low);
    if (k % 2 === 0) { const l2 = low.clone(); l2.y -= 0.09; l2.x *= 1.25; l2.z -= 0.025; pts.push(l2); }
    const w0 = 0.085 + 0.01 * Math.sin(k * 2.1);
    const ph = rand(0, TAU);
    const fine = pts.map((p, i) => p.clone().add(awayFromHead(p).multiplyScalar(0.005)).add(V3(Math.sin(i * 2.3 + ph) * 0.008, 0, 0)));
    if (false) bangGeos.push(ribbon(fine, { segs: 24, radial: 6, width: (t) => 0.005 * (1 - t ** 1.5) + 0.0008, thick: () => 0.0012, up: awayFromHead , root: 0.14 }));
    bangGeos.push(ribbon(pts.map((p, i) => p.clone().add(V3(Math.sin(i * 1.7 + ph) * 0.004, 0, 0))), { segs: 30, radial: 10, crescent: 0.7,
      width: (t) => w0 * (0.5 + 0.5 * sstep(0.3, 0.75, t)) * (1 - t ** 3) + 0.0015, thick: (t) => 0.005 * (1 - t) + 0.0015, up: awayFromHead , root: 0.14 }));
  };
  for (let k = 0; k < 3; k++) { frontLock(1, k, 3); frontLock(-1, k, 3); }
  // face-framing side locks in front of the ears, wavy, flicking outward at the tips
  for (const side of [1, -1]) for (const [dp, w0, drop] of [[0.0, 0.07, 1.0], [0.16, 0.055, 0.8]]) {
    const ph = F + side * (1.02 + dp);
    const pts = [onHead(0.55, ph - side * 0.2, 1.08), onHead(1.2, ph, 1.1), onHead(1.75, ph + side * 0.04, 1.09)];
    const e = onHead(2.2, ph + side * 0.02, 1.07); e.y -= 0.03 * drop; pts.push(e);
    const tip = e.clone(); tip.y -= 0.035 * drop; tip.x += side * 0.035; tip.z += 0.012; pts.push(tip);
    bangGeos.push(ribbon(pts, { segs: 30, radial: 10, crescent: 0.8, width: (t) => w0 * (0.55 + 0.6 * Math.sin(Math.PI * Math.min(1, t * 1.25))) * (1 - t ** 2.5) + 0.0015, thick: (t) => 0.007 * (1 - t) + 0.0015, up: awayFromHead, root: 0.14 }));
  }
  // ahoge: a springy curl on the crown
  const ahogeP = joint(headM, 0, 0, 0);
  { const s0 = onHead(0.18, F + 0.35, 1.06);
    ahogeP.position.copy(s0); ahogeP.scale.setScalar(1.45);
    const pts = [V3(0, -0.004, 0), V3(0.004, 0.035, 0.012), V3(0.018, 0.068, 0.0), V3(0.036, 0.074, -0.022), V3(0.042, 0.058, -0.03)];
    const g = ribbon(pts, { segs: 26, radial: 8, width: (t) => 0.014 * (1 - t ** 1.6) + 0.001, thick: (t) => 0.004 * (1 - t) + 0.001, up: () => V3(1, 0, 0.3).normalize() });
    mesh(g, hairMat({ value: V3() }), ahogeP, { outline: 0.0025 });
    ahogeP.userData.w = V3(); ahogeP.userData.v = V3(); }
  for (const [p0, p1, th] of [[PART - 0.05, F - 0.28, 1.22], [PART + 0.05, F + 0.42, 1.15]]) {
    bangGeos.push(ribbon([onHead(0.2, p0, 1.07), onHead(0.7, (p0 + p1) / 2, 1.14), onHead(th, p1, 1.11)], { segs: 16, radial: 6, width: (t) => 0.022 * (1 - t ** 2) + 0.001, thick: () => 0.004, up: awayFromHead , root: 0.14 }));
  }
  { const sway = { value: V3() }; mesh(mergeGeometries(bangGeos), hairMat(sway), headM, { outline: 0.003 }).name = 'front'; hairGroups.push({ key: 'F', sway, vel: V3(), off: V3() }); }
  for (const k of ['L', 'R', 'B']) {
    const sway = { value: V3() };
    const lm = mesh(mergeGeometries(lockSets[k]), hairMat(sway), headM, { outline: 0.0028 }); lm.name = 'locks' + k;
    hairGroups.push({ key: k, sway, vel: V3(), off: V3() });
  }
  // leaf ornament in the hair
  const leafShape = new THREE.Shape(); leafShape.moveTo(0, 0); leafShape.quadraticCurveTo(0.018, 0.022, 0, 0.05); leafShape.quadraticCurveTo(-0.018, 0.022, 0, 0);
  const leafG = new THREE.ExtrudeGeometry(leafShape, { depth: 0.003, bevelEnabled: false });
  for (const [phi, th, rz] of [[Math.PI / 2 + 0.95, 0.6, 0.6], [Math.PI / 2 + 1.1, 0.72, -0.3]]) {
    const p = onHead(th, phi, 1.12); mesh(leafG, toon(C.leaf, { side: THREE.DoubleSide }), headM, { pos: p.toArray(), rot: [0.3, -0.9, rz] });
  }

  OLS = 1;
  // arms
  const shirtMat = toon(C.shirt), bracerMat = toon(0xffffff, { map: bracerTex() }), sleeveMat = toon(0xffffff, { map: foldTex(C.shirt, '#9c8a66', '#efe3c8', 9) });
  const hands = {};
  for (const s of [1, -1]) {
    const L = s > 0 ? 'L' : 'R';
    const sh = J['sh' + L] = joint(J.chest, s * 0.172, 0.212, -0.005, 'sh' + L);
    mesh(new THREE.SphereGeometry(0.056, 20, 14), toon(C.tunic), sh, { outline: OL });
    if (s > 0) {
      const pg = new THREE.SphereGeometry(0.088, 24, 12, 0, TAU, 0, 1.35); pg.scale(1.05, 0.85, 1.1);
      const pa = mesh(pg, toon(C.leatherDk), sh, { pos: [0.012, 0.012, 0], rot: [0, 0, -0.35], outline: OL });
      const p2 = new THREE.SphereGeometry(0.064, 20, 10, 0, TAU, 0, 1.25); p2.scale(1.05, 0.85, 1.1);
      mesh(p2, toon(C.leather), pa, { pos: [0.004, -0.028, 0], rot: [0, 0, -0.15], outline: 0.004 });
      mesh(new THREE.TorusGeometry(0.071, 0.004, 6, 32), toon(C.gold), pa, { pos: [0, 0.016, 0], rot: [Math.PI / 2, 0, 0] }).scale.set(1.05, 1.1, 1);
      for (let k = 0; k < 3; k++) mesh(new THREE.SphereGeometry(0.007, 8, 6), toon(C.gold), pa, { pos: [0.06 * Math.cos(-0.6 + k * 0.6), 0.03, 0.06 * Math.sin(-0.6 + k * 0.6) + 0.01] });
    }
    mesh(lathe([[0, 0.03], [0.058, 0.01], [0.066, -0.05], [0.062, -0.12], [0.056, -0.2], [0.059, -0.25], [0.05, -0.285], [0, -0.29]], { uv: true }), sleeveMat, sh, { outline: OL }).scale.y = ARM;
    const el = J['el' + L] = joint(sh, 0, -0.28 * ARM, 0, 'el' + L);
    mesh(lathe([[0.03, 0.02], [0.05, 0.015], [0.052, -0.02], [0.03, -0.03]], { seg: 24 }), shirtMat, el, { outline: 0.003 });
    mesh(lathe([[0, -0.01], [0.045, -0.015], [0.048, -0.06], [0.04, -0.2], [0.037, -0.235], [0, -0.24]], { uv: true }), bracerMat, el, { outline: OL }).scale.y = ARM;
    for (const y of [-0.03, -0.225 * ARM]) mesh(new THREE.TorusGeometry(y < -0.1 ? 0.039 : 0.048, 0.005, 6, 24), toon(C.leatherDk), el, { pos: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
    const wr = J['wr' + L] = joint(el, 0, -0.24 * ARM, 0, 'wr' + L);
    hands[L] = buildHand(wr, s); hands[L].hand.scale.setScalar(1.4);
  }

  // hood lying on the shoulders + cloak anchor + brooch
  const hoodG = new THREE.SphereGeometry(0.15, 28, 18, Math.PI / 2 + 0.9, TAU - 1.8, 0.35, 1.5);
  hoodG.scale(1.15, 0.72, 0.85);
  { const p = hoodG.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + 0.012 * Math.sin(p.getX(i) * 60)); }
  hoodG.computeVertexNormals();
  mesh(hoodG, toon(C.cloak, { side: THREE.DoubleSide }), J.chest, { pos: [0, 0.255, -0.07], rot: [-0.35, 0, 0], outline: 0.003 });
  {
    const g = new THREE.CylinderGeometry(0.17, 0.27, 0.2, 40, 6, true, Math.PI * 0.24, Math.PI * 1.52);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const ang = Math.atan2(x, z);
      if (y < -0.08) y += 0.018 * Math.max(0, Math.cos(ang * 16));     // scalloped hem
      z *= 0.74; y -= 0.03 * Math.max(0, Math.cos(ang));             // front dips
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    if (false) mesh(g, toon(0xffffff, { map: foldTex(0x3a6a31, '#1d3a1a', '#5f9150', 10), side: THREE.DoubleSide }), J.chest, { pos: [0, 0.2, -0.02], outline: 0.003 });
  }
  {
    const sg = lathe([[0.05, 0.228], [0.094, 0.232], [0.1, 0.25], [0.09, 0.275], [0.058, 0.286]], { seg: 32, zs: 0.9, uv: true });
    mesh(sg, toon(0xffffff, { map: foldTex(C.scarf, '#3e0c10', '#a9373a', 12) }), J.chest, { outline: OL });
  }
  const brooch = joint(J.chest, 0.135, 0.205, 0.105);
  mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 24), bronzeMat, brooch, { rot: [Math.PI / 2 - 0.3, 0, 0.5], outline: 0.002 });
  mesh(leafG, toon(0x7a5a2a), brooch, { pos: [0, -0.02, 0.008], rot: [-0.3, 0, 0.3] });

  OLS = 1;
  return { faces, ahogeP, rig, J, hands, skirt, hairGroups, hairU, headM, faceMat, faceOpen, faceClosed, quiver, quiverArrows, HC, R };
}

// Hand: fingerless glove over the palm and first phalanx; three-segment fingers with
// knuckles and nails; thumb with a fleshy pad. Palm faces -X for the left hand
// (s = 1), +X for the right; the back of the hand is +s·X.
function buildHand(wr, s) {
  const skin = toon(C.skin), glove = toon(C.glove), nail = toon(0xf3d6c6), gloveDk = toon(0x2a1b12);
  const hand = joint(wr, 0, 0, 0);
  // palm: rounded slab, slightly cupped, wider at the knuckles
  const palm = new THREE.SphereGeometry(1, 24, 18);
  { const p = palm.attributes.position; for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const ty = (1 - y) / 2;                                   // 0 at the knuckles .. 1 at the wrist
      const flat = Math.sign(y) * Math.pow(Math.abs(y), 0.55);  // squarer top/bottom
      p.setXYZ(i, x * 0.0125 - s * 0.003 * (1 - z * z), flat * 0.037, z * 0.037 * (1 - 0.16 * ty));
  } palm.computeVertexNormals(); }
  mesh(palm, glove, hand, { pos: [0, -0.046, 0], outline: 0.0018 });
  mesh(lathe([[0.024, 0.006], [0.03, 0.002], [0.03, -0.012], [0.024, -0.016]], { seg: 20, zs: 1.45, xs: 0.8 }), gloveDk, hand, { outline: 0.0015 }); // cuff
  // thenar pad at the thumb root
  const pad = new THREE.SphereGeometry(0.016, 14, 10); pad.scale(0.8, 1.2, 0.9);
  mesh(pad, glove, hand, { pos: [-s * 0.006, -0.05, 0.026], outline: 0.0015 });
  const fingers = [];
  const fz = [0.026, 0.009, -0.008, -0.024];
  const fl = [[0.026, 0.017, 0.015], [0.029, 0.019, 0.016], [0.027, 0.018, 0.015], [0.021, 0.014, 0.013]];
  const fr = [0.0076, 0.008, 0.0075, 0.0066];
  const seg = (len, r0, r1) => { const g = lathe([[0, 0.003], [r0 * 0.9, 0.002], [r0, -0.002], [r1, -len + 0.003], [r1 * 0.75, -len], [0, -len - 0.002]], { seg: 12 }); return g; };
  fz.forEach((z, i) => {
    const L = fl[i], r = fr[i];
    const j1 = joint(hand, 0, -0.082 + (i === 1 ? -0.003 : i === 3 ? 0.004 : 0), z);
    mesh(seg(L[0], r, r * 0.92), skin, j1, { outline: 0.0012 });

    const j2 = joint(j1, 0, -L[0], 0);
    mesh(seg(L[1], r * 0.9, r * 0.84), skin, j2, { outline: 0.0012 });
    const j3 = joint(j2, 0, -L[1], 0);
    mesh(seg(L[2], r * 0.82, r * 0.72), skin, j3, { outline: 0.0012 });
    const ng = new THREE.SphereGeometry(r * 0.62, 10, 6, 0, TAU, 0, Math.PI / 2); ng.scale(1, 1.5, 0.95); ng.rotateZ(-s * Math.PI / 2);
    mesh(ng, nail, j3, { pos: [s * r * 0.35, -L[2] * 0.62, 0] });
    fingers.push({ j1, j2, j3, i });
  });
  const t1 = joint(hand, -s * 0.004, -0.03, 0.03);
  t1.rotation.set(0.85, 0, s * 0.4);
  mesh(seg(0.024, 0.0105, 0.0095), skin, t1, { outline: 0.0012 });
  { const b = new THREE.CylinderGeometry(0.0112, 0.0116, 0.012, 12); b.translate(0, -0.005, 0); mesh(b, glove, t1, { outline: 0.0012 }); }
  const t2 = joint(t1, 0, -0.024, 0);
  mesh(seg(0.019, 0.0095, 0.0085), skin, t2, { outline: 0.0012 });
  const t3 = joint(t2, 0, -0.019, 0);
  mesh(seg(0.016, 0.0085, 0.0075), skin, t3, { outline: 0.0012 });
  const tn = new THREE.SphereGeometry(0.0055, 10, 6, 0, TAU, 0, Math.PI / 2); tn.scale(1, 1.5, 0.95); tn.rotateZ(-s * Math.PI / 2);
  mesh(tn, nail, t3, { pos: [s * 0.004, -0.01, 0] });
  return { hand, fingers, thumb: { t1, t2, t3 }, s, curl: 0.3 };
}
// a: 0 open .. 1.4 fist; spread fans the fingers when relaxed
// Mediterranean draw: index above the arrow, middle and ring below, hooked at the
// middle joint; little finger folded, thumb tucked toward the palm. k blends it in.
function setHook(h, k) {
  if (k <= 0) return;
  const P = [[0.2, 1.45, 0.45], [0.18, 1.5, 0.45], [0.26, 1.42, 0.4], [1.05, 1.45, 1.0]];
  h.fingers.forEach((f, i) => {
    const p = P[i];
    for (const [j, v] of [[f.j1, p[0]], [f.j2, p[1]], [f.j3, p[2]]]) j.rotation.z += (-h.s * v - j.rotation.z) * k;
    f.j1.rotation.x *= 1 - k;
  });
  h.thumb.t2.rotation.x += (0.8 - h.thumb.t2.rotation.x) * k;
  h.thumb.t3.rotation.x += (0.6 - h.thumb.t3.rotation.x) * k;
}
function setCurl(h, a, spread = 1) {
  h.curl = a;
  for (const f of h.fingers) {
    const fan = (f.i - 1.5) * 0.07 * spread * Math.max(0, 1 - a);
    const lag = 1 + 0.08 * f.i;                              // outer fingers curl a touch more
    f.j1.rotation.set(fan, 0, -h.s * a * 0.8 * lag);
    f.j2.rotation.set(0, 0, -h.s * a * 1.05 * lag);
    f.j3.rotation.set(0, 0, -h.s * a * 0.75 * lag);
  }
  h.thumb.t2.rotation.set(0.45 * a, 0, 0);
  h.thumb.t3.rotation.set(0.5 * a, 0, 0);
}

// ------------------------------------------------------------------ bow + arrow
function makeArrow(inQuiver) {
  const g = new THREE.Group();
  const shaft = new THREE.CylinderGeometry(0.0045, 0.0045, 0.74, 6); shaft.rotateZ(Math.PI / 2); shaft.translate(0.37, 0, 0);
  mesh(shaft, toon(0x8a6a44), g, { outline: 0.0012 });
  const head = new THREE.ConeGeometry(0.012, 0.05, 4); head.rotateZ(-Math.PI / 2); head.translate(0.765, 0, 0);
  const headM = mesh(head, toon(C.metal), g, { outline: 0.0012 });
  const fin = new THREE.BufferGeometry();
  fin.setAttribute('position', new THREE.Float32BufferAttribute([0.02, 0, 0, 0.13, 0, 0, 0.03, 0.022, 0, 0.13, 0, 0, 0.1, 0.02, 0, 0.03, 0.022, 0], 3)); fin.computeVertexNormals();
  for (let k = 0; k < 3; k++) { const f = mesh(fin, toon(inQuiver ? 0x5d8a3a : 0x6f9d45, { side: THREE.DoubleSide }), g); f.rotation.x = k * TAU / 3; }
  g.userData.head = headM;
  return g;
}
function buildBow() {
  const bow = new THREE.Group();
  const woodMat = toon(C.wood);
  const limb = (sgn) => {
    const grp = new THREE.Group(); bow.add(grp);
    const pts = [[0, 0.04], [-0.028, 0.24], [-0.095, 0.45], [-0.16, 0.62], [-0.175, 0.72], [-0.15, 0.785]].map(([x, y]) => V3(x, sgn * y, 0));
    const g = ribbon(pts, { segs: 30, radial: 10, width: (t) => 0.02 * (1 - 0.65 * t) + 0.004, thick: (t) => 0.013 * (1 - 0.5 * t) + 0.003, up: () => V3(0, 0, 1) });
    mesh(g, woodMat, grp, { outline: 0.0025 });
    // carved leaf inlays along the limb
    for (const t of [0.35, 0.6]) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.06), new THREE.MeshToonMaterial({ color: C.leaf, gradientMap: RAMP, side: THREE.DoubleSide }));
      const c = new THREE.CatmullRomCurve3(pts).getPointAt(t);
      leaf.position.copy(c).add(V3(0.004, 0, 0.0)); leaf.rotation.set(0, Math.PI / 2, sgn * 0.3); grp.add(leaf);
    }
    const nock = new THREE.Object3D(); nock.position.set(-0.168, sgn * 0.765, 0); grp.add(nock);
    return { grp, nock };
  };
  const up = limb(1), lo = limb(-1);
  mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.13, 12), toon(C.leatherDk), bow, { outline: 0.0025 });
  // string: two thin cylinders meeting at the draw point
  const sMat = new THREE.MeshBasicMaterial({ color: 0xe8e0c8 });
  const sGeo = new THREE.CylinderGeometry(0.0016, 0.0016, 1, 4); sGeo.translate(0, 0.5, 0);
  const s1 = new THREE.Mesh(sGeo, sMat), s2 = new THREE.Mesh(sGeo, sMat);
  return { bow, up, lo, s1, s2 };
}
function setSegment(m, a, b) {
  const d = V3().subVectors(b, a); const len = d.length();
  m.position.copy(a); m.scale.set(1, len, 1);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.normalize());
}

// ------------------------------------------------------------------ cloak cloth
class Cloak {
  constructor(scene, chest) {
    this.cols = 17; this.rows = 22; this.chest = chest;
    const n = this.cols * this.rows;
    this.p = new Float32Array(n * 3); this.q = new Float32Array(n * 3);
    this.anchor = [];
    const A0 = 1.2, A1 = TAU - 1.2;
    chest.updateWorldMatrix(true, false);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const a = A0 + (A1 - A0) * c / (this.cols - 1);
      const fr = r / (this.rows - 1);
      const flare = 1 + 0.85 * fr, front = Math.max(0, Math.cos(a));
      const pleat = 1 + 0.07 * fr * Math.sin(a * 11);
      const loc = V3(Math.sin(a) * 0.19 * flare * pleat, 0.245 - 0.03 * front - fr * 0.78, Math.cos(a) * 0.135 * flare * pleat - 0.02);
      if (r === 0) this.anchor.push(V3(Math.sin(a) * 0.19, 0.245 - 0.03 * front, Math.cos(a) * 0.135 - 0.02));
      const w = loc.clone().applyMatrix4(chest.matrixWorld);
      const i = (r * this.cols + c) * 3; this.p[i] = this.q[i] = w.x; this.p[i + 1] = this.q[i + 1] = w.y; this.p[i + 2] = this.q[i + 2] = w.z;
    }
    // constraints from the rest shape (structural, shear, bend)
    this.cons = [];
    const add = (a, b, k) => { const ia = a * 3, ib = b * 3; const d = Math.hypot(this.p[ia] - this.p[ib], this.p[ia + 1] - this.p[ib + 1], this.p[ia + 2] - this.p[ib + 2]); this.cons.push(a, b, d, k); };
    const id = (r, c) => r * this.cols + c;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      if (c < this.cols - 1) add(id(r, c), id(r, c + 1), 1);
      if (r < this.rows - 1) add(id(r, c), id(r + 1, c), 1);
      if (r < this.rows - 1 && c < this.cols - 1) { add(id(r, c), id(r + 1, c + 1), 0.5); add(id(r, c + 1), id(r + 1, c), 0.5); }
      if (r < this.rows - 2) add(id(r, c), id(r + 2, c), 0.3);
      if (c < this.cols - 2) add(id(r, c), id(r, c + 2), 0.2);
    }
    // mesh
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    const uv = [], idx = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) uv.push(c / (this.cols - 1), 1 - r / (this.rows - 1));
    for (let r = 0; r < this.rows - 1; r++) for (let c = 0; c < this.cols - 1; c++) { const a = id(r, c), b = id(r, c + 1), d = id(r + 1, c), e = id(r + 1, c + 1); idx.push(a, d, b, b, d, e); }
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    this.geo = geo;
    const aMap = cloakAlpha();
    const outer = new THREE.Mesh(geo, toon(0xffffff, { map: cloakTex(), alphaMap: aMap, alphaTest: 0.5, side: THREE.BackSide }));
    const inner = new THREE.Mesh(geo, toon(0x16301d, { alphaMap: aMap, alphaTest: 0.5, side: THREE.FrontSide }));
    for (const m of [outer, inner]) { m.castShadow = true; m.frustumCulled = false; scene.add(m); }
    this.meshes = [outer, inner];
    this.colliders = [];
    this.wind = V3(0.6, 0, -0.2);
  }
  impulse(v) { for (let i = this.cols * 3; i < this.p.length; i += 3) { this.q[i] -= v.x * 0.016; this.q[i + 1] -= v.y * 0.016; this.q[i + 2] -= v.z * 0.016; } }
  step(dt, t) {
    const sub = 3, h = dt / sub;
    this.chest.updateWorldMatrix(true, false);
    const anchors = this.anchor.map((a) => a.clone().applyMatrix4(this.chest.matrixWorld));
    const p = this.p, q = this.q;
    for (let s = 0; s < sub; s++) {
      for (let i = 0; i < p.length / 3; i++) {
        const k = i * 3;
        if (i < this.cols) { const a = anchors[i]; p[k] = q[k] = a.x; p[k + 1] = q[k + 1] = a.y; p[k + 2] = q[k + 2] = a.z; continue; }
        const r = Math.floor(i / this.cols), c = i % this.cols;
        const gust = 0.6 + 0.4 * Math.sin(t * 1.7 + c * 0.4 + r * 0.25) * Math.sin(t * 0.63 + r * 0.1);
        const fx = this.wind.x * gust * 1.4, fy = -9.8, fz = this.wind.z * gust * 1.4;
        const vx = (p[k] - q[k]) * 0.985, vy = (p[k + 1] - q[k + 1]) * 0.985, vz = (p[k + 2] - q[k + 2]) * 0.985;
        q[k] = p[k]; q[k + 1] = p[k + 1]; q[k + 2] = p[k + 2];
        p[k] += vx + fx * h * h; p[k + 1] += vy + fy * h * h; p[k + 2] += vz + fz * h * h;
      }
      for (let it = 0; it < 5; it++) {
        const cs = this.cons;
        for (let j = 0; j < cs.length; j += 4) {
          const a = cs[j] * 3, b = cs[j + 1] * 3, rest = cs[j + 2], kk = cs[j + 3];
          const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
          const d = Math.hypot(dx, dy, dz) || 1e-6; const diff = (d - rest) / d * 0.5 * kk;
          const pa = cs[j] < this.cols, pb = cs[j + 1] < this.cols;
          if (pa && pb) continue;
          const wa = pa ? 0 : pb ? 2 : 1, wb = pb ? 0 : pa ? 2 : 1;
          p[a] += dx * diff * wa; p[a + 1] += dy * diff * wa; p[a + 2] += dz * diff * wa;
          p[b] -= dx * diff * wb; p[b + 1] -= dy * diff * wb; p[b + 2] -= dz * diff * wb;
        }
        this.collide();
      }
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.computeVertexNormals();
  }
  collide() {
    const p = this.p, tmp = V3(), cp = V3();
    for (let i = this.cols; i < p.length / 3; i++) {
      const k = i * 3; tmp.set(p[k], p[k + 1], p[k + 2]);
      for (const c of this.colliders) {
        // capsule a-b radius r (optionally squashed in z around the body)
        const ab = c.ab, t = clamp(V3().subVectors(tmp, c.a).dot(ab) / c.ab2, 0, 1);
        cp.copy(c.a).addScaledVector(ab, t);
        const d = V3().subVectors(tmp, cp); const len = d.length();
        if (len < c.r) { tmp.copy(cp).addScaledVector(d, c.r / (len || 1e-6)); }
      }
      if (tmp.y < BASE + 0.02) tmp.y = BASE + 0.02;
      p[k] = tmp.x; p[k + 1] = tmp.y; p[k + 2] = tmp.z;
    }
  }
}

// ------------------------------------------------------------------ effects pool
class FX {
  constructor(scene) {
    this.scene = scene;
    this.glow = glowTex(); this.leafT = leafTex();
    this.sprites = []; this.leaves = [];
    for (let i = 0; i < 260; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false; scene.add(s); this.sprites.push({ s, life: 0 });
    }
    const leafGeo = new THREE.PlaneGeometry(0.05, 0.05);
    for (let i = 0; i < 90; i++) {
      const m = new THREE.Mesh(leafGeo, new THREE.MeshBasicMaterial({ map: this.leafT, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
      m.visible = false; scene.add(m); this.leaves.push({ m, life: 0 });
    }
    // arrow trail ribbon
    this.trailN = 26; this.trailPts = [];
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailN * 2 * 3), 3));
    tg.setAttribute('a', new THREE.BufferAttribute(new Float32Array(this.trailN * 2), 1));
    const ti = []; for (let i = 0; i < this.trailN - 1; i++) { const a = i * 2; ti.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } tg.setIndex(ti);
    this.trail = new THREE.Mesh(tg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute float a; varying float vA; varying float vS; void main(){ vA = a; vS = float(gl_VertexID % 2); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: 'varying float vA; varying float vS; void main(){ float e = 1. - abs(vS*2.-1.); gl_FragColor = vec4(vec3(0.6,1.5,0.8) * vA * (0.25 + e), 1.); }',
    }));
    this.trail.frustumCulled = false; scene.add(this.trail);
    // charge spiral: three arcs around the arrow
    this.spiral = new THREE.Group(); scene.add(this.spiral);
    for (let k = 0; k < 3; k++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.07 + k * 0.025, 0.004, 6, 40, 4.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.8, 0.9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      arc.rotation.y = Math.PI / 2; arc.userData.k = k; this.spiral.add(arc);
    }
    this.spiral.visible = false;
    // rings (release / impact)
    this.rings = [];
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.4, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; scene.add(m); this.rings.push({ m, life: 0 });
    }
  }
  spark(p, v, life, color, size, drag = 2, grav = 0) {
    const e = this.sprites.find((x) => x.life <= 0); if (!e) return;
    e.s.visible = true; e.s.position.copy(p); e.v = v.clone(); e.life = e.max = life; e.size = size; e.drag = drag; e.grav = grav;
    e.s.material.color.copy(color);
  }
  leaf(p, v, life, tint) {
    const e = this.leaves.find((x) => x.life <= 0); if (!e) return;
    e.m.visible = true; e.m.position.copy(p); e.v = v.clone(); e.life = e.max = life; e.spin = V3(rand(-8, 8), rand(-8, 8), rand(-8, 8));
    e.m.material.color.copy(tint || new THREE.Color(0.55, 0.85, 0.35));
  }
  ring(p, normal, r0, r1, life, color) {
    const e = this.rings.find((x) => x.life <= 0); if (!e) return;
    e.m.visible = true; e.m.position.copy(p); e.m.quaternion.setFromUnitVectors(V3(0, 0, 1), normal.clone().normalize());
    e.life = e.max = life; e.r0 = r0; e.r1 = r1; e.m.material.color.copy(color || new THREE.Color(1.6, 2.4, 1.2));
  }
  update(dt, camera) {
    for (const e of this.sprites) {
      if (e.life <= 0) continue;
      e.life -= dt; if (e.life <= 0) { e.s.visible = false; continue; }
      e.v.multiplyScalar(Math.exp(-e.drag * dt)); e.v.y += e.grav * dt; e.s.position.addScaledVector(e.v, dt);
      const k = e.life / e.max; e.s.scale.setScalar(e.size * (0.4 + 0.6 * k)); e.s.material.opacity = Math.min(1, k * 1.5);
    }
    for (const e of this.leaves) {
      if (e.life <= 0) continue;
      e.life -= dt; if (e.life <= 0) { e.m.visible = false; continue; }
      e.v.multiplyScalar(Math.exp(-1.6 * dt)); e.v.y -= 1.2 * dt; e.m.position.addScaledVector(e.v, dt);
      e.m.rotation.x += e.spin.x * dt; e.m.rotation.y += e.spin.y * dt; e.m.rotation.z += e.spin.z * dt;
      e.m.material.opacity = Math.min(1, (e.life / e.max) * 2);
    }
    for (const e of this.rings) {
      if (e.life <= 0) continue;
      e.life -= dt; if (e.life <= 0) { e.m.visible = false; continue; }
      const k = 1 - e.life / e.max; e.m.scale.setScalar(e.r0 + (e.r1 - e.r0) * easeOut(k, 3)); e.m.material.opacity = (1 - k) * 1.1;
    }
    // trail
    const pos = this.trail.geometry.attributes.position, a = this.trail.geometry.attributes.a;
    const pts = this.trailPts;
    const camPos = camera.position;
    for (let i = 0; i < this.trailN; i++) {
      const s = pts[Math.min(i, pts.length - 1)];
      if (!s) { pos.setXYZ(i * 2, 0, -99, 0); pos.setXYZ(i * 2 + 1, 0, -99, 0); a.setX(i * 2, 0); a.setX(i * 2 + 1, 0); continue; }
      const nxt = pts[Math.min(i + 1, pts.length - 1)], prv = pts[Math.min(Math.max(i - 1, 0), pts.length - 1)];
      const dir = V3().subVectors(nxt.p, prv.p); if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
      const side = V3().crossVectors(dir, V3().subVectors(camPos, s.p)).normalize();
      const w = 0.03 * (1 - i / this.trailN) * s.a;
      pos.setXYZ(i * 2, s.p.x + side.x * w, s.p.y + side.y * w, s.p.z + side.z * w);
      pos.setXYZ(i * 2 + 1, s.p.x - side.x * w, s.p.y - side.y * w, s.p.z - side.z * w);
      const al = s.a * (1 - i / this.trailN);
      a.setX(i * 2, al); a.setX(i * 2 + 1, al);
    }
    pos.needsUpdate = true; a.needsUpdate = true;
    for (const s of pts) s.a *= Math.exp(-dt * 3.5);
  }
}

// ------------------------------------------------------------------ environment
const U_TIME = { value: 0 };
const runeTex = () => canvasTex(512, 512, (g, w) => {
  const c = w / 2; g.clearRect(0, 0, w, w);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff';
  g.lineWidth = 6; g.beginPath(); g.arc(c, c, 240, 0, TAU); g.stroke();
  g.lineWidth = 3; g.beginPath(); g.arc(c, c, 214, 0, TAU); g.stroke();
  g.beginPath(); g.arc(c, c, 120, 0, TAU); g.stroke();
  for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; g.save(); g.translate(c + Math.cos(a) * 227, c + Math.sin(a) * 227); g.rotate(a); g.fillRect(-2, -8, 4, i % 3 ? 10 : 16); g.restore(); }
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU; g.save(); g.translate(c + Math.cos(a) * 168, c + Math.sin(a) * 168); g.rotate(a + Math.PI / 2);
    g.beginPath(); g.moveTo(0, -26); g.quadraticCurveTo(18, 0, 0, 26); g.quadraticCurveTo(-18, 0, 0, -26); g.fill(); g.restore();
  }
  for (let i = 0; i < 3; i++) { const a = i / 3 * TAU; g.beginPath(); g.moveTo(c + Math.cos(a) * 120, c + Math.sin(a) * 120); g.lineTo(c + Math.cos(a + Math.PI) * 120, c + Math.sin(a + Math.PI) * 120); g.stroke(); }
});
// Battle stage: the painted target is replaced by an invisible aim point toward the
// enemy hero; only the plinth and the charge rune remain.
function buildBattleWorld(scene, aim, plinth = true) {
  const base = new THREE.Group(); scene.add(base); base.visible = plinth;
  mesh(new THREE.CylinderGeometry(0.44, 0.47, BASE - 0.012, 64), toon(0x2e2016), base, { pos: [0, (BASE - 0.012) / 2, 0], outline: 0.004 });
  mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.012, 64), toon(0x33452a), base, { pos: [0, BASE - 0.006, 0], receive: true });
  mesh(new THREE.TorusGeometry(0.455, 0.008, 8, 80), toon(0xb08a4a), base, { pos: [0, BASE - 0.018, 0], rot: [Math.PI / 2, 0, 0] });
  const face = new THREE.Group(); face.position.copy(aim); scene.add(face); face.userData.disk = new THREE.Object3D();
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshBasicMaterial({ map: runeTex(), color: new THREE.Color(0.8, 2.2, 1.1), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  rune.rotation.x = -Math.PI / 2; rune.position.set(0.05, BASE + 0.004, 0); rune.scale.setScalar(0.6); scene.add(rune);
  const rune2 = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
  return { face, shafts: [], rune, rune2 };
}

// ------------------------------------------------------------------ app
function createVesper(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power', preserveDrawingBuffer: !!opts.preserve });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.className = 'vesper-miniature-canvas';
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 80);
  const controls = { target: V3(), update() { camera.lookAt(this.target); } };
  const HOME = { pos: (opts.camera || V3(0.05, 0.9, 2.3)).clone(), target: (opts.look || V3(0.22, 0.6, -0.05)).clone() };
  const resetView = () => { camera.position.copy(HOME.pos); controls.target.copy(HOME.target); controls.update(); };
  resetView();

  scene.add(new THREE.HemisphereLight(0x8fa6c4, 0x2a2a1c, 0.5));
  const key = new THREE.DirectionalLight(0xffc68a, 2.0); key.position.set(4, 3.2, 3.2); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1.5, bottom: -0.5, near: 1, far: 12 }); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc8ff, 1.6); rim.position.set(-3, 3.5, -4.5); scene.add(rim);
  const sunBack = new THREE.DirectionalLight(0xffa860, 2.4); sunBack.position.set(3, 1.6, -5); scene.add(sunBack);
  const bowLight = new THREE.PointLight(0x9dff9a, 0, 1.2, 2); scene.add(bowLight);

  const world = buildBattleWorld(scene, opts.aim || V3(4, 1.6, -3), opts.plinth !== false);
  CHAR_BUILD = true;
  const V = buildVesper(scene);
  CHAR_BUILD = false;
  const { J, hands } = V;
  const B = buildBow(); B.bow.scale.setScalar(0.62); scene.add(B.bow); scene.add(B.s1, B.s2);
  // bow in the left hand: the arrow line (+X bow) runs along the fingers (-Y hand), the
  // limbs (+Y bow) along the thumb (+Z hand); the grip sits in the curled fingers
  const BOW_IN_HAND = quatFromBasis(V3(0, -1, 0), V3(0, 0, 1), V3(-1, 0, 0));
  const BOW_GRIP_LOCAL = V3(-0.022, -0.075, 0);
  const ARW = 0.55;
  const arrow = makeArrow(false); arrow.scale.setScalar(ARW); scene.add(arrow); arrow.visible = false;
  const cloak = new Cloak(scene, J.chest);
  const fx = new FX(scene);


  // ---------------------------------------------------------------- poses (euler per joint)
  const IDLE = {
    root: [0, 0.18, 0], spine: [0.02, -0.05, -0.04], chest: [-0.04, -0.12, 0.03], neck: [0.02, -0.12, 0], head: [0.1, -0.22, 0.07],
    shL: [-0.3, 0, 0.2], elL: [-0.45, 0, 0], wrL: [-0.75, 0.2, 0], shR: [0.06, 0, -0.13], elR: [-0.22, 0, 0], wrR: [0, 0, 0.1],
    hipL: [-0.04, 0, 0.07], knL: [0.08, 0, 0], anL: [-0.04, 0, -0.07], hipR: [0.04, 0, -0.05], knR: [0.03, 0, 0], anR: [-0.07, 0, 0.05],
  };
  const STANCE = {
    root: [0.45, -0.08, 0], spine: [0.02, 0.1, 0.04], chest: [0.0, 0.12, -0.02], neck: [0, 0.22, 0], head: [0.06, 0.45, 0.04],
    shL: [-0.3, 0, 0.8], elL: [-0.2, 0, 0], wrL: [0, 0, 0], shR: [0.06, 0, -0.13], elR: [-0.22, 0, 0], wrR: [0, 0, 0],
    hipL: [-0.12, 0, 0.3], knL: [0.25, 0, 0], anL: [-0.12, 0, -0.26], hipR: [0.06, 0, -0.27], knR: [0.14, 0, 0], anR: [-0.02, 0, 0.24],
  };
  const R_REACH = { shR: [0.55, 0, -0.35], elR: [-0.55, 0, 0], wrR: [0.2, 0, 0] };
  const R_RAISE = { shR: [-1.45, 0.3, -0.3], elR: [-1.5, 0, 0], wrR: [0, 0, 0] };
  const R_RELEASE = { shR: [-0.2, -0.4, -1.35], elR: [-0.7, 0, 0], wrR: [0.4, 0, 0.3] };
  const qCache = {};
  const eq = (e) => new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2]));
  const lerpPose = (a, b, t, out = {}) => {
    for (const k of Object.keys(a)) {
      const ka = a[k], kb = b[k] || ka;
      out[k] = [ka[0] + (kb[0] - ka[0]) * t, ka[1] + (kb[1] - ka[1]) * t, ka[2] + (kb[2] - ka[2]) * t];
    }
    return out;
  };
  const JOINTS = ['spine', 'chest', 'neck', 'head', 'shL', 'elL', 'wrL', 'shR', 'elR', 'wrR', 'hipL', 'knL', 'anL', 'hipR', 'knR', 'anR'];

  // ---------------------------------------------------------------- IK
  const L1 = 0.28 * ARM * K, L2 = 0.24 * ARM * K;
  const tmpQ = new THREE.Quaternion(), pq = new THREE.Quaternion();
  function solveArm(side, wristT, pole, handWorldQ, w) { solveLimb(J['sh' + side], J['el' + side], J['wr' + side], L1, L2, wristT, pole, handWorldQ, w, -1); }
  function solveLimb(sh, el, wr, L1, L2, wristT, pole, handWorldQ, w, zs) {
    if (w <= 0.001) return;
    sh.parent.updateWorldMatrix(true, false);
    const S = sh.getWorldPosition(V3());
    const d = V3().subVectors(wristT, S); let dist = clamp(d.length(), 0.05, (L1 + L2) * 0.998); const dir = d.normalize();
    const cosA = clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
    let pp = V3().subVectors(pole, S); pp.addScaledVector(dir, -pp.dot(dir));
    if (pp.lengthSq() < 1e-8) pp.set(0, -1, 0); pp.normalize();
    const E = V3().copy(S).addScaledVector(dir, L1 * cosA).addScaledVector(pp, L1 * sinA);
    const T = V3().copy(S).addScaledVector(dir, dist);
    const y = V3().subVectors(S, E).normalize();
    const z = pp.clone().addScaledVector(y, -pp.dot(y)).normalize().multiplyScalar(zs);
    const x = V3().crossVectors(y, z).normalize();
    const Qs = quatFromBasis(x, y, V3().crossVectors(x, y));
    sh.parent.getWorldQuaternion(pq);
    tmpQ.copy(pq).invert().multiply(Qs);
    sh.quaternion.slerp(tmpQ, w);
    sh.updateWorldMatrix(false, false);
    const y2 = V3().subVectors(E, T).normalize();
    const z2 = V3().crossVectors(x, y2).normalize();
    const Qe = quatFromBasis(x, y2, z2);
    sh.getWorldQuaternion(pq);
    tmpQ.copy(pq).invert().multiply(Qe);
    el.quaternion.slerp(tmpQ, w);
    el.updateWorldMatrix(false, false);
    if (handWorldQ) { el.getWorldQuaternion(pq); tmpQ.copy(pq).invert().multiply(handWorldQ); wr.quaternion.slerp(tmpQ, w); }
    wr.updateWorldMatrix(false, true);
  }

  // ---------------------------------------------------------------- state
  const S = {
    t: 0, timeScale: 1, auto: false, idleFor: 0, atk: -1, arrowState: 'quiver', flyPos: V3(), flyDir: V3(1, 0, 0), stuckT: 0,
    mode: 'shot', hurt: -1, rain: [], aimTarget: V3(), draw: 0, stringVib: 0, shake: 0, blinkAt: 2, prevHead: V3(), aim: V3(1, 0, 0), charge: 0, released: false, hit: false, phase: '待机',
  };
  const TARGET_C = world.face.getWorldPosition(V3());
  const VOLLEY_UP = V3(3.2, 4.4, -0.4);
  const setPhase = (p) => { if (p !== S.phase) { S.phase = p; opts.onPhase && opts.onPhase(p); } };

  function pinchWorld() { return hands.R.hand.localToWorld((S.pinchLocal || V3(0.004, -0.095, 0.012)).clone()); }
  function anchorWorld() { return V.headM.localToWorld(V3(-0.045, -0.085, 0.075)); }

  const B2 = { sq: 0, sqv: 0, hopY: 0, hopV: 0, kx: 0, kv: 0, air: false };
  function hop(v) { B2.hopV = Math.max(B2.hopV, v); B2.air = true; }
  function bounce(dt) {
    const a = S.atk;
    // squash target: breathing in idle, squash while drawing, crouch before the volley jump
    let sqT = 0.014 * Math.sin(S.t * TAU / 2.1);
    if (S.vic >= 0 && S.vic != null && S.vic < 0.28) sqT = -0.12 * Math.sin(S.vic / 0.28 * Math.PI);
    if (a >= 0 && a < S.releaseAt) sqT = -0.06 * sstep(S.drawFrom, S.aimFrom, a) + (a < 0.12 ? -0.04 * Math.sin(a / 0.12 * Math.PI) : 0);
    B2.sqv += ((sqT - B2.sq) * 260 - B2.sqv * 13) * dt; B2.sq += B2.sqv * dt; B2.sq = clamp(B2.sq, -0.22, 0.25);
    if (B2.air) {
      B2.hopV -= 9.8 * dt; B2.hopY += B2.hopV * dt;
      if (B2.hopY <= 0) { B2.hopY = 0; B2.air = false; B2.sqv -= Math.abs(B2.hopV) * 2.6; B2.hopV = 0; for (let i = 0; i < 8; i++) { const an = rand(0, TAU); fx.spark(V3(Math.cos(an) * 0.2, BASE + 0.02, Math.sin(an) * 0.2), V3(Math.cos(an) * 0.6, 0.3, Math.sin(an) * 0.6), 0.4, new THREE.Color(1.1, 1.1, 0.9), 0.04, 3); } }
    }
    B2.kv += (-B2.kx * 70 - B2.kv * 9) * dt; B2.kx += B2.kv * dt;
    const sy = 1 + B2.sq, sxz = 1 / Math.sqrt(sy);
    V.rig.scale.set(K * sxz, K * sy, K * sxz);
    V.rig.position.set(B2.kx, BASE + B2.hopY, 0);
    V.rig.rotation.y = S.spin || 0;
    V.rig.updateMatrixWorld(true);
  }
  function pose(dt) {
    bounce(dt);
    const t = S.t, a = S.atk;
    // base: idle, blended toward the stance during the attack
    const stanceW = a < 0 ? 0 : sstep(0.0, 0.28, a) * (1 - sstep(1.65, 2.3, a));
    const P = lerpPose(IDLE, STANCE, stanceW);
    // right arm FK storyboard
    if (a >= 0) {
      let rp = null, rw = 0;
      if (a < 0.3) { rp = R_REACH; rw = sstep(0.05, 0.28, a); }
      else if (a < 0.62) { rp = lerpPose(R_REACH, R_RAISE, sstep(0.3, 0.5, a)); rw = 1; }
      else if (a < S.releaseAt) { rp = R_RAISE; rw = 1; }
      else { rp = R_RELEASE; rw = 1 - sstep(1.7, 2.3, a); }
      for (const k of Object.keys(rp)) { const b = rp[k], c = P[k]; P[k] = [c[0] + (b[0] - c[0]) * rw, c[1] + (b[1] - c[1]) * rw, c[2] + (b[2] - c[2]) * rw]; }
    }
    if (S.fid >= 0 && S.fid != null) {
      const f = S.fid, w = sstep(0, 0.45, f) * (1 - sstep(FID - 0.6, FID, f));
      const lis = sstep(PLUCKS[0] - 0.3, PLUCKS[0], f);
      const up = { shL: [-1.15, 0.35, 0.05], elL: [-1.25, 0, 0], wrL: [0.2, 0, 0], head: [0.22 * lis + 0.08, 0.08 + 0.06 * lis, 0.16 * lis], chest: [0.05, 0.12, 0], neck: [0.05, 0.1, 0] };
      for (const k of Object.keys(up)) { const b = up[k], c = P[k]; P[k] = [c[0] + (b[0] - c[0]) * w, c[1] + (b[1] - c[1]) * w, c[2] + (b[2] - c[2]) * w]; }
      // tiny nod after the last pluck
      P.head[0] += 0.12 * Math.sin(clamp((f - 2.45) / 0.35, 0, 1) * Math.PI);
    }
    // victory overlay: bow arm straight up, free arm pumping
    if (S.vic >= 0 && S.vic != null) {
      const v = S.vic, w = sstep(0, 0.2, v) * (1 - sstep(VIC - 0.45, VIC, v));
      const pump = 0.5 + 0.5 * Math.sin((v - 1.0) * TAU * 2.2);
      const up = { shL: [-2.1, 0, 1.25], elL: [-0.2, 0, 0], wrL: [0, 0, 0],
        shR: v < 1.0 ? [-2.1, 0, -1.25] : [-1.2 - 0.9 * pump, 0, -1.0], elR: [v < 1.0 ? -0.2 : -1.7 + 0.9 * pump, 0, 0], wrR: [0, 0, 0],
        chest: [-0.12, 0, 0.06 * Math.sin(v * 8)], head: [-0.2, 0, 0.12 * Math.sin(v * 5)], spine: [-0.05, 0, 0] };
      for (const k of Object.keys(up)) { const b = up[k], c = P[k]; P[k] = [c[0] + (b[0] - c[0]) * w, c[1] + (b[1] - c[1]) * w, c[2] + (b[2] - c[2]) * w]; }
      if (v < 0.28) P.root[1] -= 0.06 * Math.sin(v / 0.28 * Math.PI);
    }
    // idle life: breathing, weight shift, looking around
    const br = Math.sin(t * TAU / 4.2), idleW = 1 - stanceW * 0.7;
    P.chest[0] += -0.025 * br; P.spine[0] += 0.01 * br;
    P.head[1] += idleW * (0.07 * Math.sin(t * 0.37) + 0.03 * Math.sin(t * 1.1));
    P.head[0] += idleW * 0.04 * Math.sin(t * 0.53 + 1);
    P.root[2] += idleW * 0.02 * Math.sin(t * TAU / 6.5);
    if (a >= S.aimFrom && a < S.releaseAt) { P.chest[1] += 0.006 * Math.sin(t * 17); P.head[0] += 0.004 * Math.sin(t * 13); }
    const vk = S.mode === 'volley' ? stanceW : 0;
    P.chest[0] -= 0.22 * vk; P.spine[0] -= 0.1 * vk; P.head[0] -= 0.35 * vk; P.root[1] -= 0.03 * vk;
    let hk = 0, hurtShift = 0;
    if (S.hurt >= 0 && S.bolt && S.bolt.hit) {
      const h = S.hurt - S.boltAt;
      hk = Math.exp(-h * 5) * sstep(0, 0.04, h) + 0.25 * sstep(0.05, 0.3, h) * (1 - sstep(0.6, 1.4, h));
      hurtShift = -0.09 * (Math.exp(-h * 4) * sstep(0, 0.05, h)) - 0.02 * (1 - sstep(0.4, 1.4, h)) * sstep(0, 0.1, h);
      P.chest[2] += 0.28 * hk; P.spine[2] += 0.12 * hk; P.head[2] += 0.25 * hk; P.head[0] += 0.18 * hk; P.chest[0] += 0.12 * hk;
      P.shL[2] += 0.5 * hk; P.shR[2] -= 0.35 * hk; P.elL[0] -= 0.4 * hk; P.elR[0] -= 0.5 * hk; P.root[1] -= 0.06 * hk;
      S.hurtK = hk;
    } else S.hurtK = 0;
    // release recoil
    if (a >= S.releaseAt) { const k = Math.exp(-(a - S.releaseAt) * 9) * sstep(S.releaseAt, S.releaseAt + 0.02, a); P.chest[1] -= 0.12 * k; P.spine[0] -= 0.05 * k; }
    // apply
    J.root.position.set(0.012 * Math.sin(t * TAU / 6.5) * idleW + stanceW * 0.02 + hurtShift, 0.98, 0);
    J.root.rotation.set(0, P.root[0] + 0.18 * (1 - stanceW) - 0.18 * (1 - stanceW), P.root[2]);
    J.root.rotation.y = 0.46 * (1 - stanceW) + STANCE.root[0] * stanceW;
    J.root.rotation.z += 0.05 * (1 - stanceW);
    J.root.position.y = 0.645 - 0.05 * stanceW + 0.004 * br + P.root[1];
    P.head[0] += clamp(B2.hopV * 0.06 + B2.sqv * 0.25, -0.25, 0.25); P.chest[0] += clamp(-B2.sqv * 0.12, -0.15, 0.15);
    for (const k of JOINTS) J[k].quaternion.setFromEuler(new THREE.Euler(...P[k]));
    // skirt panels follow the thighs
    for (const s of V.skirt) {
      const hip = J['hip' + s.leg];
      const e = new THREE.Euler().setFromQuaternion(hip.quaternion);
      s.piv.rotation.set(s.back ? Math.max(0, e.x) * 0.3 : Math.min(0, e.x) * 0.7, 0, e.z * 0.65);
    }
    J.root.updateWorldMatrix(true, true);
    // ---- legs: feet planted on the ground (two-bone IK), knees toward the toes
    for (const [L, sgn] of [['L', 1], ['R', -1]]) {
      const idleF = L === 'L' ? [0.13, 0.07, 0.55] : [-0.11, -0.06, -0.25];
      const stF = L === 'L' ? [0.2, 0.14, 0.62] : [-0.17, -0.14, 0.05];
      const volF = L === 'L' ? [0.22, 0.16, 0.75] : [-0.2, -0.12, 0.2];
      const sf = S.mode === 'volley' ? volF : stF;
      const f = [0, 1, 2].map((i) => (idleF[i] + (sf[i] - idleF[i]) * stanceW) * (i < 2 ? K : 1));
      // hurt: the back foot slides a step
      const slide = L === 'R' ? -0.06 * sstep(0.0, 0.25, S.hurtK || 0) : 0;
      const target = V3(f[0] + slide * K + B2.kx, 0.085 * K + BASE + B2.hopY, f[1]);
      const yaw = f[2];
      const footQ = new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), yaw);
      const hipW = J['hip' + L].getWorldPosition(V3());
      const fwd = V3(Math.sin(yaw), 0, Math.cos(yaw));
      const pole = hipW.clone().addScaledVector(fwd, 1).add(V3(sgn * 0.08, -0.4, 0));
      solveLimb(J['hip' + L], J['kn' + L], J['an' + L], 0.43 * LEG * K, 0.41 * LEG * K, target, pole, footQ, 1, 1);
    }

    // ---- bow arm IK and bow placement
    const aimW = a < 0 ? 0 : sstep(0.06, 0.34, a) * (1 - sstep(1.6, 2.2, a));
    const anchor = anchorWorld();
    if (a >= 0 && a < S.releaseAt + 0.02) S.aim.copy(S.mode === 'volley' ? VOLLEY_UP : TARGET_C).sub(anchor).normalize();
    const up0 = V3(0, 1, 0).addScaledVector(S.aim, -S.aim.y).normalize();
    let bz = V3().crossVectors(S.aim, up0).normalize(); let by = V3().crossVectors(bz, S.aim).normalize();
    by.addScaledVector(bz, -0.18).normalize(); bz = V3().crossVectors(S.aim, by).normalize();
    const bowAimQ = quatFromBasis(S.aim.clone(), by, bz);
    const gripAim = anchor.clone().addScaledVector(S.aim, 0.36 * K).addScaledVector(by, -0.02 * K);
    const handQ = bowAimQ.clone().multiply(BOW_IN_HAND.clone().invert());
    const wristT = gripAim.clone().sub(BOW_GRIP_LOCAL.clone().applyQuaternion(handQ));
    const shLpos = J.shL.getWorldPosition(V3());
    solveArm('L', wristT, shLpos.clone().add(V3(0, -0.5, -0.35)), handQ, aimW);
    // bow follows the hand
    hands.L.hand.updateWorldMatrix(true, false);
    const hq = hands.L.hand.getWorldQuaternion(new THREE.Quaternion());
    B.bow.quaternion.copy(hq).multiply(BOW_IN_HAND);
    B.bow.position.copy(hands.L.hand.localToWorld(BOW_GRIP_LOCAL.clone()));
    // draw amount and limb flex
    let draw = 0;
    if (a >= 0) {
      if (a < S.releaseAt) draw = easeOut(sstep(S.drawFrom, S.aimFrom, a) * 1.0, 2);
      S.draw = draw;
    } else S.draw = 0;
    const flex = 0.09 * S.draw;
    B.up.grp.rotation.z = flex; B.lo.grp.rotation.z = -flex;
    B.bow.updateMatrixWorld(true);
    const nockTop = B.up.nock.getWorldPosition(V3()), nockBot = B.lo.nock.getWorldPosition(V3());
    const bowX = V3(1, 0, 0).applyQuaternion(B.bow.quaternion), bowY = V3(0, 1, 0).applyQuaternion(B.bow.quaternion);
    const stringRest = nockTop.clone().lerp(nockBot, 0.5);
    // ---- draw arm
    let drawW = a < 0 ? 0 : sstep(0.48, 0.6, a) * (1 - sstep(S.releaseAt, S.releaseAt + 0.06, a));
    let drawPt = stringRest.clone().lerp(anchor, S.draw);
    let pull = 0;
    if (S.fid >= 0 && S.fid != null) {
      const f = S.fid;
      drawW = Math.max(drawW, sstep(0.55, 0.85, f) * (1 - sstep(2.45, 2.8, f)));
      pull = pluckAmt(f);
      drawPt = stringRest.clone().addScaledVector(bowX, -0.03 * pull - 0.004);
    }
    const rHandX = V3(0, 0, -1).addScaledVector(bowX, 0.0); const rHandY = bowX.clone().negate();
    rHandX.addScaledVector(rHandY, -rHandX.dot(rHandY)).normalize();
    const rHandQ = quatFromBasis(rHandX, rHandY, V3().crossVectors(rHandX, rHandY));
    let cr = 0.6;
    if (a >= 0) {
      if (a < 0.22) cr = 0.6 + 0.2 * sstep(0.1, 0.22, a);
      else if (a < S.releaseAt) cr = 1.05;
      else cr = 0.2 + 0.4 * sstep(S.releaseAt + 0.3, S.releaseAt + 0.8, a);
    }
    if (S.vic >= 0 && S.vic != null) cr = 1.4;
    if (S.fid >= 0 && S.fid != null) cr = 0.9;
    setCurl(hands.R, cr, 0.4); setCurl(hands.L, 1.35);
    setHook(hands.R, a >= 0 && a < S.releaseAt ? sstep(0.5, 0.62, a) : 0);
    hands.R.hand.updateMatrixWorld(true);
    const hookA = hands.R.fingers[0].j3.getWorldPosition(V3()), hookB = hands.R.fingers[1].j3.getWorldPosition(V3());
    const pinchLocal = hands.R.hand.worldToLocal(hookA.lerp(hookB, 0.5));
    S.pinchLocal = pinchLocal.clone();
    const rWrist = drawPt.clone().sub(pinchLocal.clone().applyQuaternion(rHandQ));
    const shRpos = J.shR.getWorldPosition(V3());
    solveArm('R', rWrist, shRpos.clone().addScaledVector(bowX, -0.25).add(V3(0, -0.9, -0.35)), rHandQ, drawW);
    // string
    let sp = stringRest.clone();
    if (pull > 0.01) sp = stringRest.clone().addScaledVector(bowX, -0.03 * pull);
    if (a >= 0 && a < S.releaseAt && drawW > 0.5) sp = pinchWorld().lerp(stringRest, 0).clone();
    if (a >= 0 && a < S.releaseAt) sp = stringRest.clone().lerp(pinchWorld(), sstep(0.55, 0.62, a));
    {
      const busy = (S.fid >= 0 && S.fid != null) || (S.vic >= 0 && S.vic != null);
      const hipW = (1 - Math.max(drawW, stanceW)) * (busy ? 0 : 1) * (1 - (S.hurtK || 0));
      S.hipW = (S.hipW || 0) + (hipW - (S.hipW || 0)) * Math.min(1, dt * 8);
      if (S.hipW > 0.01) {
        const hipPt = J.root.localToWorld(V3(-0.2, 0.27, -0.02));
        const out = J.root.localToWorld(V3(-1.5, 0.35, -0.5));
        const rq = J.root.getWorldQuaternion(new THREE.Quaternion());
        const fdir = V3(0.75, -0.45, -0.2).normalize().applyQuaternion(rq);
        const hy = fdir.clone().negate(), hz0 = V3(0, 0, 1).applyQuaternion(rq);
        const hz = hz0.addScaledVector(hy, -hz0.dot(hy)).normalize(), hx = V3().crossVectors(hy, hz);
        solveArm('R', hipPt, out, quatFromBasis(hx, hy, hz), S.hipW);
        setCurl(hands.R, 1.2 * S.hipW + cr * (1 - S.hipW));
      }
    }
    if (S.stringVib > 0) sp.addScaledVector(bowX, Math.sin(S.t * 90) * 0.02 * S.stringVib);
    setSegment(B.s1, nockTop, sp); setSegment(B.s2, nockBot, sp);

    // ---- arrow
    const qa = V.quiverArrows[0];
    if (S.arrowState === 'quiver') { arrow.visible = false; qa.visible = true; }
    if (a >= 0.24 && S.arrowState === 'quiver') { S.arrowState = 'hand'; qa.visible = false; }
    if (S.arrowState === 'hand') {
      arrow.visible = true;
      const s = sstep(0.36, 0.6, a);
      const dirUp = V3(-0.15, 1, 0.1).normalize();
      const nockPt = pinchWorld();
      const dir = dirUp.clone().lerp(V3().subVectors(B.bow.position, nockPt).normalize(), s).normalize();
      if (a >= 0.6) S.arrowState = 'nocked';
      placeArrow(nockPt.addScaledVector(dir, -0.04 * (1 - s)), dir);
    }
    if (S.arrowState === 'nocked') {
      const nockPt = sp.clone();
      const rest = B.bow.position.clone().addScaledVector(bowY, 0.03);
      placeArrow(nockPt, V3().subVectors(rest, nockPt).normalize());
    }
    if (S.arrowState === 'flying' && S.mode === 'volley') {
      S.flyPos.addScaledVector(S.flyDir, 22 * dt);
      if (S.flyPos.y > 4.2) { S.arrowState = 'gone'; burst(S.flyPos.clone()); arrow.visible = false; }
      else placeArrow(S.flyPos, S.flyDir);
      fx.trailPts.unshift({ p: S.flyPos.clone().addScaledVector(S.flyDir, 0.3), a: 1 }); if (fx.trailPts.length > fx.trailN) fx.trailPts.pop();
    } else if (S.arrowState === 'flying') {
      S.flyPos.addScaledVector(S.flyDir, 30 * dt);
      if (opts.flyOut && S.flyPos.distanceTo(S.flyFrom) > opts.flyOut) { S.arrowState = 'gone'; arrow.visible = false; }
      const tip = S.flyPos.clone().addScaledVector(S.flyDir, 0.78 * ARW);
      const toT = V3().subVectors(TARGET_C, tip);
      if (toT.dot(S.flyDir) < 0.03) {
        const back = toT.dot(S.flyDir) - 0.03; S.flyPos.addScaledVector(S.flyDir, back + 0.1);
        S.arrowState = 'stuck'; impact(S.flyPos.clone().addScaledVector(S.flyDir, 0.68 * ARW));
      }
      placeArrow(S.flyPos, S.flyDir);
      fx.trailPts.unshift({ p: S.flyPos.clone().addScaledVector(S.flyDir, 0.3), a: 1 }); if (fx.trailPts.length > fx.trailN) fx.trailPts.pop();
      if (Math.random() < 0.7) fx.leaf(S.flyPos.clone(), V3(rand(-0.4, 0.4), rand(0.2, 0.8), rand(-0.4, 0.4)), rand(0.6, 1.1));
      fx.spark(S.flyPos.clone(), V3(rand(-0.3, 0.3), rand(-0.3, 0.3), rand(-0.3, 0.3)), 0.35, new THREE.Color(1, 2.4, 1.2), 0.05, 1);
    }
    if (S.arrowState === 'stuck') { placeArrow(S.flyPos, S.flyDir); if (a < 0 || a > 2.9) { S.arrowState = 'quiver'; } }
    if (S.arrowState === 'gone') { arrow.visible = false; if (a < 0 || a > 2.9) S.arrowState = 'quiver'; }

    // ---- charge effects
    const charging = a >= S.drawFrom + 0.1 && a < S.releaseAt;
    S.charge = charging ? Math.min(1, S.charge + dt * 2.2) : Math.max(0, S.charge - dt * 6);
    fx.spiral.visible = S.charge > 0.02;
    if (fx.spiral.visible) {
      const tipP = arrow.localToWorld(V3(0.62, 0, 0));
      fx.spiral.position.copy(tipP); fx.spiral.quaternion.setFromUnitVectors(V3(1, 0, 0), S.aim);
      fx.spiral.children.forEach((arc, k) => { arc.rotation.x = S.t * (6 + k * 2.5) * (k % 2 ? -1 : 1); arc.material.opacity = S.charge * (0.55 + 0.25 * Math.sin(S.t * 20 + k)); arc.scale.setScalar((1.2 - 0.35 * S.charge + 0.05 * k) * 0.6); });
      if (Math.random() < S.charge * 0.8) {
        const off = V3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(0.25, 0.45));
        fx.spark(tipP.clone().add(off.multiplyScalar(0.6)), off.clone().multiplyScalar(-3.2), 0.28, new THREE.Color(0.9, 2.2, 1.1), 0.03, 0.5);
      }
      if (Math.random() < S.charge * 0.25) { const off = V3(rand(-1, 1), rand(-0.4, 1), rand(-1, 1)).normalize().multiplyScalar(0.55); fx.leaf(tipP.clone().add(off), off.clone().multiplyScalar(-2.2), 0.5); }
      const headSpr = tipP;
      bowLight.position.copy(headSpr); bowLight.intensity = S.charge * 0.15;
    } else bowLight.intensity = Math.max(0, bowLight.intensity - dt * 10);
  }
  function placeArrow(nock, dir) { arrow.position.copy(nock); arrow.quaternion.setFromUnitVectors(V3(1, 0, 0), dir.clone().normalize()); }
  function release() {
    B2.sqv += 3.2; hop(S.mode === 'volley' ? 1.9 : 1.0); B2.kv -= S.mode === 'volley' ? 0.4 : 0.9;
    S.arrowState = 'flying'; S.flyPos.copy(arrow.position); S.flyFrom = arrow.position.clone(); S.flyDir.copy(V3(1, 0, 0).applyQuaternion(arrow.quaternion));
    S.stringVib = 1; S.shake = Math.max(S.shake, 0.5);
    const p = arrow.localToWorld(V3(0.55, 0, 0));
    fx.ring(p, S.flyDir, 0.03, 0.26, 0.35, new THREE.Color(1.3, 2.6, 1.3));
    fx.ring(p, S.flyDir, 0.02, 0.16, 0.25, new THREE.Color(2.4, 2.4, 1.6));
    for (let i = 0; i < 26; i++) { const v = S.flyDir.clone().multiplyScalar(rand(1, 5)).add(V3(rand(-1.2, 1.2), rand(-1.2, 1.2), rand(-1.2, 1.2))); fx.spark(p.clone(), v, rand(0.2, 0.45), new THREE.Color(1.4, 3, 1.5), rand(0.03, 0.07), 3); }
    for (let i = 0; i < 10; i++) fx.leaf(p.clone(), S.flyDir.clone().multiplyScalar(rand(1, 3)).add(V3(rand(-1, 1), rand(0, 1.5), rand(-1, 1))), rand(0.8, 1.4));
    cloak.impulse(S.flyDir.clone().multiplyScalar(-1.2).add(V3(0, 0.4, 0)));
    fx.ring(V3(0.05, BASE + 0.02, 0), V3(0, 1, 0), 0.15, 0.8, 0.5, new THREE.Color(0.45, 1.1, 0.55));
    for (let i = 0; i < 16; i++) { const a = rand(0, TAU); fx.leaf(V3(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3), V3(Math.cos(a) * rand(1.5, 3), rand(0.5, 1.6), Math.sin(a) * rand(1.5, 3)), rand(0.8, 1.4)); }
    V.hairGroups.forEach((h) => h.vel.addScaledVector(S.flyDir, -0.45));
    fx.trailPts.length = 0;
  }
  // volley: the arrow bursts into a ring of light arrows that rain on the target area
  const rainPool = [];
  const rainMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.8, 1.4) });
  for (let i = 0; i < 22; i++) {
    const r = makeArrow(false); const mat = rainMat.clone(); r.userData.mat = mat; r.traverse((o) => { if (o.isMesh && o.material.side !== THREE.BackSide) o.material = mat; }); r.visible = false; scene.add(r); rainPool.push(r);
  }
  function burst(p) {
    S.shake = Math.max(S.shake, 0.4);
    fx.ring(p, V3(0, 1, 0), 0.1, 1.4, 0.6, new THREE.Color(1.4, 2.8, 1.4));
    fx.spark(p.clone(), V3(), 0.25, new THREE.Color(1.8, 2.4, 1.4), 1.0, 0);
    for (let i = 0; i < 40; i++) fx.spark(p.clone(), V3(rand(-1, 1), rand(-0.5, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1, 4)), rand(0.3, 0.7), new THREE.Color(1.2, 2.6, 1.3), rand(0.03, 0.07), 2);
    S.rain = rainPool.map((m, i) => {
      const a = rand(0, TAU), r = Math.sqrt(Math.random()) * 1.1;
      const land = V3(TARGET_C.x - 0.2 + Math.cos(a) * r, 0, TARGET_C.z + Math.sin(a) * r * 0.9);
      const from = land.clone().add(V3(-1.1 + rand(-0.2, 0.2), 4.2, rand(-0.2, 0.2)));
      m.visible = false; m.userData.mat.color.setRGB(1.2, 2.8, 1.4);
      return { m, from, land, t: -0.08 - i * 0.03 - rand(0, 0.04), dur: 0.3, hit: false };
    });
    world.face.userData.kick = 0;
  }
  function updateRain(dt) {
    for (const r of S.rain) {
      r.t += dt;
      if (r.t < 0) continue;
      const k = Math.min(1, r.t / r.dur);
      const dir = V3().subVectors(r.land, r.from).normalize();
      const pos = r.from.clone().lerp(r.land, k * k * (1.4 - 0.4 * k));
      r.m.visible = r.t < r.dur + 1.6;
      r.m.position.copy(pos.addScaledVector(dir, -(k < 1 ? 0.78 : 0.55))); r.m.quaternion.setFromUnitVectors(V3(1, 0, 0), dir);
      if (k < 1) fx.spark(r.m.position.clone().addScaledVector(dir, 0.5), V3(), 0.22, new THREE.Color(1, 2.4, 1.2), 0.07, 0);
      if (k >= 1) { const f = Math.max(0, 1 - (r.t - r.dur) / 1.6); r.m.userData.mat.color.setRGB(1.2 * f + 0.3, 2.8 * f + 0.4, 1.4 * f + 0.3); }
      if (k >= 1 && !r.hit) {
        r.hit = true; S.shake = Math.max(S.shake, 0.35);
        fx.ring(r.land.clone().add(V3(0, 0.03, 0)), V3(0, 1, 0), 0.03, 0.45, 0.4, new THREE.Color(1.3, 2.6, 1.3));
        for (let i = 0; i < 10; i++) fx.spark(r.land.clone().add(V3(0, 0.05, 0)), V3(rand(-1, 1), rand(0.5, 2), rand(-1, 1)), rand(0.3, 0.6), new THREE.Color(1.4, 2.8, 1.4), 0.04, 2, -4);
        for (let i = 0; i < 3; i++) fx.leaf(r.land.clone().add(V3(0, 0.05, 0)), V3(rand(-1, 1), rand(1, 2), rand(-1, 1)), rand(0.8, 1.3));
        world.face.userData.kick = Math.max(world.face.userData.kick || 0, 0.6);
      }
    }
    // ground rune under the target while the rain falls
    const live = S.rain.some((r) => r.t > -0.2 && r.t < r.dur + 0.3);
    world.rune2.material.opacity += ((live ? 0.8 : 0) - world.rune2.material.opacity) * Math.min(1, dt * 6);
    world.rune2.rotation.z -= dt * 1.5;
  }
  // enemy bolt: violet orb from the target to her chest
  function updateBolt(dt) {
    if (S.hurt < 0) return;
    S.hurt += dt;
    const b = S.bolt;
    if (b && !b.hit) {
      const tgt = J.chest.localToWorld(V3(0, 0.12, 0.05));
      const d = V3().subVectors(tgt, b.p); const L = d.length();
      b.p.addScaledVector(d.normalize(), Math.min(L, 9 * dt));
      fx.spark(b.p.clone(), V3(), 0.12, new THREE.Color(2.2, 0.9, 2.6), 0.22, 0);
      fx.spark(b.p.clone(), V3(rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5)), 0.4, new THREE.Color(1.4, 0.5, 1.8), 0.05, 1);
      if (L < 0.12) {
        b.hit = true; B2.sqv -= 3.5; B2.kv -= 2.6; hop(0.9); S.boltAt = S.hurt; S.shake = 1; S.hitFlash = 1;
        fx.ring(tgt, V3(1, 0, 0), 0.04, 0.6, 0.35, new THREE.Color(2.4, 1.0, 2.6));
        for (let i = 0; i < 36; i++) fx.spark(tgt.clone(), V3(rand(-0.5, 2), rand(-1, 1.5), rand(-1.2, 1.2)).multiplyScalar(rand(1, 2.5)), rand(0.3, 0.6), new THREE.Color(2, 0.8, 2.4), rand(0.03, 0.06), 2.5, -2);
        cloak.impulse(V3(-1.5, 0.5, 0)); V.hairGroups.forEach((h) => h.vel.add(V3(-0.6, 0.2, 0)));
      }
    }
    if (b && b.hit && S.hurt - S.boltAt > 1.5) { S.hurt = -1; S.bolt = null; }
  }
  function impact(p) {
    S.shake = 1; S.hit = true;
    const n = S.flyDir.clone().negate();
    fx.ring(p, n, 0.05, 0.95, 0.5, new THREE.Color(1.6, 2.8, 1.4));
    fx.ring(p, n, 0.05, 0.6, 0.35, new THREE.Color(2.8, 2.6, 1.6));
    fx.spark(p.clone(), V3(), 0.16, new THREE.Color(1.8, 1.9, 1.4), 0.6, 0);
    for (let i = 0; i < 48; i++) { const v = V3(rand(-1, 1), rand(-0.6, 1.2), rand(-1, 1)).normalize().multiplyScalar(rand(1.5, 5)).addScaledVector(n, 2); fx.spark(p.clone(), v, rand(0.3, 0.7), new THREE.Color(1.6, 3, 1.4), rand(0.03, 0.08), 2.5, -3); }
    for (let i = 0; i < 24; i++) fx.leaf(p.clone(), V3(rand(-1, 1), rand(0, 2), rand(-1, 1)).multiplyScalar(2).addScaledVector(n, 1.5), rand(1, 1.8));
    world.face.userData.kick = 1;
  }

  // ---------------------------------------------------------------- attack timeline
  Object.assign(S, { drawFrom: 0.64, aimFrom: 0.95, releaseAt: 1.22 });
  function attack(mode = 'shot', lead = null) {
    if (S.vic >= 0 && S.vic != null) return;
    S.fid = -1; S.hurt = -1; S.bolt = null;
    if (S.atk < 0 || S.atk > 2.5) { S.mode = mode; S.atk = lead == null ? 0 : Math.max(0, S.releaseAt - lead); S.released = false; S.hit = false; S.charge = 0; S.arrowState = 'quiver'; }
  }
  // enemy bolt from the target, then the hit reaction
  // victory cheer: crouch, jump with a full spin and the bow raised, fist pump, second hop
  const VIC = 2.9;
  // idle fidget: bring the bow up, pluck the string three times, listen, lower it
  const FID = 3.4, PLUCKS = [1.05, 1.65, 2.2];
  function fidget() {
    if ((S.atk >= 0 && S.atk < 2.5) || S.hurt >= 0 || (S.vic >= 0 && S.vic != null)) return;
    S.fid = 0;
  }
  function pluckAmt(f) { let p = 0; for (const t0 of PLUCKS) { const d = f - (t0 - 0.2); if (d > 0 && d < 0.2) p = Math.max(p, sstep(0, 0.2, d)); } return p; }
  function victory() {
    if ((S.atk >= 0 && S.atk < 2.5) || S.hurt >= 0) return;
    S.atk = -1; S.vic = 0; S.vicHops = 0;
  }
  function updateFidget(dt) {
    if (S.fid < 0 || S.fid == null) return;
    const prev = S.fid; S.fid += dt;
    for (const t0 of PLUCKS) if (prev < t0 && S.fid >= t0) {
      S.stringVib = 1;
      const p = B.bow.position.clone().add(V3(0, 0.12, 0.05));
      for (let i = 0; i < 6; i++) fx.spark(p.clone().add(V3(rand(-0.04, 0.04), rand(-0.1, 0.1), 0)), V3(rand(-0.15, 0.15), rand(0.3, 0.6), rand(-0.1, 0.1)), rand(0.6, 1), new THREE.Color(0.9, 2.2, 1.1), rand(0.025, 0.04), 1);
      fx.ring(p.clone(), V3().subVectors(camera.position, p).normalize(), 0.02, 0.14, 0.35, new THREE.Color(0.7, 1.6, 0.8));
    }
    if (S.fid > FID) S.fid = -1;
  }
  function updateVictory(dt) {
    if (S.vic < 0 || S.vic == null) { S.spin = 0; return; }
    const prev = S.vic; S.vic += dt; const v = S.vic;
    const cross = (x) => prev < x && v >= x;
    if (cross(0.28)) { hop(2.0); celebrate(1); }
    if (cross(1.45)) { hop(1.2); celebrate(0.6); }
    if (cross(2.0)) { hop(0.8); }
    S.spin = TAU * easeInOut(clamp((v - 0.28) / 0.55, 0, 1));
    if (v > VIC) { S.vic = -1; S.spin = 0; }
  }
  function celebrate(k) {
    const p = J.chest.getWorldPosition(V3()).add(V3(0, 0.35, 0));
    const cols = [new THREE.Color(2.2, 1.9, 0.8), new THREE.Color(1.2, 2.4, 1.2), new THREE.Color(2.2, 1.2, 1.6), new THREE.Color(1.2, 1.8, 2.4)];
    for (let i = 0; i < 50 * k; i++) fx.spark(p.clone(), V3(rand(-1, 1), rand(0.6, 2.2), rand(-1, 1)).multiplyScalar(rand(0.8, 1.8)), rand(0.6, 1.2), cols[i % 4], rand(0.03, 0.06), 1.5, -2.5);
    for (let i = 0; i < 24 * k; i++) fx.leaf(p.clone(), V3(rand(-1, 1), rand(1, 2.5), rand(-1, 1)), rand(1.2, 2));
    fx.ring(V3(0, BASE + 0.02, 0), V3(0, 1, 0), 0.1, 0.8, 0.6, new THREE.Color(0.8, 0.75, 0.35));
  }
  function hurt(instant = false) {
    if (S.atk >= 0 && S.atk < 2.5 && !instant) return;
    S.atk = -1; S.fid = -1; S.hurt = 0;
    S.bolt = { p: instant ? J.chest.localToWorld(V3(0.3, 0.14, 0.2)) : TARGET_C.clone(), hit: false, quiet: instant };
  }

  // ---------------------------------------------------------------- loop
  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (document.hidden || !container.isConnected || container.hidden || !container.offsetParent) { clock.getDelta(); return; }
    let dt = Math.min(clock.getDelta(), 1 / 20);
    dt *= S.timeScale;
    S.t += dt; U_TIME.value = S.t;
    if (S.atk >= 0) {
      const prev = S.atk; S.atk += dt;
      if (prev < S.releaseAt && S.atk >= S.releaseAt) release();
      if (S.atk > 3.0) S.atk = -1;
      const a = S.atk;
      const v = S.mode === 'volley';
      setPhase(a < 0 ? '待机' : a < 0.6 ? '抽箭 · 搭弦' : a < S.aimFrom ? (v ? '引弓向天' : '满弓 · 聚风') : a < S.releaseAt ? '瞄准' : a < 1.6 ? (v ? '森之箭雨' : '疾风箭') : '收势');
    } else if (S.hurt >= 0) {
      setPhase('受击');
    } else if (S.vic >= 0 && S.vic != null) {
      setPhase('胜利！');
    } else if (S.fid >= 0 && S.fid != null) {
      setPhase('待机 · 调弦');
    } else {
      setPhase('待机');
      if (S.auto) { S.idleFor += dt; if (S.idleFor > 3.4) { S.idleFor = 0; S.demo = ((S.demo || 0) + 1) % 5; if (S.demo === 1) fidget(); else if (S.demo === 2) attack('shot'); else if (S.demo === 3) attack('volley'); else if (S.demo === 4) hurt(); else victory(); } }
    }
    updateBolt(dt);
    updateVictory(dt);
    updateFidget(dt);
    { const ah = V.ahogeP, hp = V.headM.getWorldPosition(V3());
      const vel = hp.clone().sub(ah.userData.last || hp); ah.userData.last = hp.clone();
      const u = ah.userData; u.v.addScaledVector(vel, -30); u.v.addScaledVector(u.w, -160 * Math.max(dt, 1e-4)); u.v.multiplyScalar(Math.exp(-5 * Math.max(dt, 1e-4)));
      u.w.addScaledVector(u.v, Math.max(dt, 1e-4)); u.w.clampLength(0, 0.7);
      ah.rotation.set(u.w.z * 2 + 0.05 * Math.sin(S.t * 2.3), 0, -u.w.x * 2); }
    pose(dt);
    updateRain(dt);
    U_HIT.value = S.hitFlash = Math.max(0, (S.hitFlash || 0) - dt * 6);
    // blink
    const aa = S.atk;
    if (S.vic >= 0 && S.vic != null) V.faceMat.map = S.vic > 0.15 && S.vic < VIC - 0.2 ? V.faces.joy : V.faceOpen;
    else if ((S.hurtK || 0) > 0.12 || (S.hurt >= 0 && S.bolt && S.bolt.hit)) V.faceMat.map = V.faces.hurt;
    else if (aa >= S.drawFrom && aa < S.releaseAt) V.faceMat.map = V.faces.focus;
    else if (aa >= S.releaseAt && aa < S.releaseAt + 0.55) V.faceMat.map = V.faces.shout;
    else if (aa >= 0 && V.faceMat.map !== V.faceOpen && V.faceMat.map !== V.faceClosed) V.faceMat.map = V.faceOpen;
    else if (S.hurt < 0 && V.faceMat.map !== V.faceOpen && V.faceMat.map !== V.faceClosed) V.faceMat.map = V.faceOpen;
    else if (S.t > S.blinkAt) { V.faceMat.map = V.faceClosed; if (S.t > S.blinkAt + 0.11) { V.faceMat.map = V.faceOpen; S.blinkAt = S.t + rand(2.5, 5); } }
    { const hw = V.headM.getWorldQuaternion(new THREE.Quaternion()), cw = J.chest.getWorldQuaternion(new THREE.Quaternion());
      V.hairU.uCounter.value.setFromMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(hw.invert().multiply(cw))); }
    // hair springs from head motion + breeze
    const hp = V.headM.getWorldPosition(V3());
    const hv = V3().subVectors(hp, S.prevHead).divideScalar(Math.max(dt, 1e-4)); S.prevHead.copy(hp);
    const hq = V.headM.getWorldQuaternion(new THREE.Quaternion()).invert();
    V.hairGroups.forEach((h, i) => {
      const wind = V3(0.035 + 0.02 * Math.sin(S.t * 1.3 + i), 0, -0.01 + 0.01 * Math.sin(S.t * 0.9 + i * 2));
      const target = wind.clone().addScaledVector(hv, -0.05);
      h.vel.addScaledVector(V3().subVectors(target, h.off), 60 * dt); h.vel.multiplyScalar(Math.exp(-7 * dt));
      h.off.addScaledVector(h.vel, dt);
      h.sway.value.copy(h.off.clone().clampLength(0, 0.12)).applyQuaternion(hq);
    });
    // cloak colliders from the joints
    const wp = (o, v = V3()) => o.localToWorld(v);
    const cap = (a, b, r) => { const ab = V3().subVectors(b, a); return { a, ab, ab2: Math.max(ab.lengthSq(), 1e-6), r }; };
    cloak.colliders = [
      cap(wp(J.root, V3(0, -0.1, -0.01)), wp(J.chest, V3(0, 0.2, -0.01)), 0.19 * K),
      cap(wp(J.hipL), wp(J.knL), 0.11 * K), cap(wp(J.hipR), wp(J.knR), 0.11 * K),
      cap(wp(J.knL), wp(J.anL), 0.085 * K), cap(wp(J.knR), wp(J.anR), 0.085 * K),
      cap(wp(J.shL), wp(J.elL), 0.075 * K), cap(wp(J.shR), wp(J.elR), 0.075 * K),
      cap(wp(J.elL), wp(J.wrL), 0.06 * K), cap(wp(J.elR), wp(J.wrR), 0.06 * K),
      cap(wp(V.headM, V3(0, 0, -0.01)), wp(V.headM, V3(0, 0.01, -0.01)), 0.108 * HS * K * 1.05),
      cap(wp(V.quiver, V3(0, -0.2, 0)), wp(V.quiver, V3(0, 0.2, 0)), 0.07 * K),
    ];
    cloak.wind.set(0.5 + 0.3 * Math.sin(S.t * 0.4), 0, -0.25);
    cloak.step(Math.max(dt, 1e-4), S.t);
    fx.update(dt, camera);
    S.stringVib = Math.max(0, S.stringVib - dt * 3);
    world.rune.material.opacity = S.charge * (0.6 + 0.2 * Math.sin(S.t * 12));
    world.rune.rotation.z += dt * (0.6 + 3 * S.charge); world.rune.scale.setScalar((0.85 + 0.25 * S.charge) * 0.6);
    world.shafts.forEach((m, i) => { m.material.opacity = 0.04 + 0.04 * (0.5 + 0.5 * Math.sin(S.t * 0.5 + i * 1.7)); });
    // target kick
    const f = world.face; f.userData.kick = Math.max(0, (f.userData.kick || 0) - dt * 3);
    f.userData.disk.rotation.x = 0.12 * f.userData.kick * Math.sin(S.t * 40);
    // ambient motes and falling leaves
    if (false) fx.spark(V3(rand(-2, 4), rand(0.15, 1.8), rand(-2, 1.5)), V3(rand(-0.08, 0.08), rand(0.02, 0.12), rand(-0.05, 0.05)), rand(2.5, 4.5), new THREE.Color(1.8, 2.0, 0.7), rand(0.018, 0.03), 0);
    if (false) fx.leaf(V3(rand(-1.5, 4), 3.2, rand(-2, 1)), V3(rand(0.1, 0.4), -0.35, rand(-0.1, 0.1)), 6, new THREE.Color(0.6, 0.75, 0.3));
    controls.update();
    // camera shake
    const sh = S.shake * S.shake * 0.02; S.shake = Math.max(0, S.shake - dt * 3);
    const save = camera.position.clone();
    camera.position.add(V3(rand(-sh, sh), rand(-sh, sh), 0));
    if (S.atk >= 0 && S.cine !== false) {
      const a = S.atk;
      const push = sstep(0.55, S.aimFrom, a) * (1 - sstep(S.releaseAt + 0.25, 2.4, a));
      const toT = V3().subVectors(controls.target, camera.position).normalize();
      camera.position.addScaledVector(toT, 0.25 * push);
      camera.position.x += 0.2 * sstep(S.releaseAt, S.releaseAt + 0.35, a) * (1 - sstep(1.7, 2.6, a));
    }
    const w = container.clientWidth, h = container.clientHeight;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    camera.position.copy(save);
    if (opts.onFrame) opts.onFrame(S);
  }
  frame();

  return {
    attack, hurt, victory, fidget, resetView,
    /** screen-space point (canvas CSS px) of the arrow tip, or the bow grip */
    launchPoint() { const p = (arrow.visible ? arrow.localToWorld(V3(0.62, 0, 0)) : B.bow.position.clone()).project(camera); return { x: (p.x + 1) / 2 * container.clientWidth, y: (1 - p.y) / 2 * container.clientHeight }; },
    set(o) { Object.assign(S, o); },
    get state() { return S; },
    seek(t) { S.atk = t; },
    destroy() { cancelAnimationFrame(raf); renderer.dispose(); },
    three: { scene, camera, renderer, controls },
  };
}

return Object.freeze({ create: createVesper });
})();
