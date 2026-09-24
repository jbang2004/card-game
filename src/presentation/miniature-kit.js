/* Parts kit for battlefield miniatures (EmberMiniatures): builds a chibi figure
 * from a data description (EmberMiniatureSpecs) — one of two skeletons,
 * `humanoid` or `quadruped` — and animates it with a shared clip library
 * (idle, attack, hurt, death, spawn). Style follows docs/design/MINIATURES.md:
 * soft four-step toon shading, warm rim, dark-brown back-face outline, painted
 * faces, big heads. Every part on a joint is merged into one vertex-coloured
 * mesh (+ one outline mesh), so a figure costs ~2 draw calls per joint.
 * Units: chibi metres, figure ≈ 1.2 tall; +Z faces the camera, +X is the
 * figure's forward for attacks. Presentation only. */
const EmberMiniatureKit = (() => {
  const THREE = EmberVesperThree;
  const { mergeGeometries } = THREE;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hex = (n) => "#" + n.toString(16).padStart(6, "0");

  // ------------------------------------------------------------ materials
  const RAMP = (() => {
    const t = new THREE.DataTexture(new Uint8Array([118, 172, 222, 255]), 4, 1, THREE.RedFormat);
    t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
  })();
  const U = { hit: { value: 0 } };
  const shade = (s, hitU) => {
    s.uniforms.uHit = hitU;
    s.fragmentShader = "uniform float uHit;\n" + s.fragmentShader.replace("#include <opaque_fragment>", `
      float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
      outgoingLight += vec3(1.0, 0.86, 0.66) * rimF * 0.24;
      outgoingLight *= 0.92 + 0.12 * normalize(normal).y;
      outgoingLight = mix(outgoingLight, vec3(1.3, 0.55, 0.5), uHit * 0.45);
      #include <opaque_fragment>`);
  };
  function bodyMaterial(hitU) {
    const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP, transparent: true });
    m.onBeforeCompile = (s) => shade(s, hitU); m.customProgramCacheKey = () => "mini-body";
    return m;
  }
  function mapMaterial(map, hitU) {
    const m = new THREE.MeshToonMaterial({ map, gradientMap: RAMP, transparent: true });
    m.onBeforeCompile = (s) => shade(s, hitU); m.customProgramCacheKey = () => "mini-map";
    return m;
  }
  function outlineMaterial(width) {
    const m = new THREE.MeshBasicMaterial({ color: 0x2e1a10, side: THREE.BackSide, transparent: true });
    m.onBeforeCompile = (s) => { s.uniforms.uW = { value: width }; s.vertexShader = "uniform float uW;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n transformed += normalize(normal) * uW;"); };
    m.customProgramCacheKey = () => "mini-outline";
    return m;
  }

  // ------------------------------------------------------------ geometry helpers
  function lathe(profile, seg = 20) {
    if (profile[profile.length - 1][1] < profile[0][1]) profile = profile.slice().reverse();
    return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  }
  function tube(points, r0, r1, radial = 8, segs = 16) {
    const curve = new THREE.CatmullRomCurve3(points);
    const g = new THREE.TubeGeometry(curve, segs, 1, radial, false);
    const p = g.attributes.position, n = g.attributes.normal, P = V3(), N = V3();
    for (let i = 0; i < p.count; i++) {
      const t = Math.floor(i / (radial + 1)) / segs, r = r0 + (r1 - r0) * t;
      const c = curve.getPointAt(Math.min(1, t));
      P.fromBufferAttribute(p, i); N.copy(P).sub(c).normalize();
      P.copy(c).addScaledVector(N, r); p.setXYZ(i, P.x, P.y, P.z);
    }
    g.computeVertexNormals(); return g;
  }
  function blade(points, width, thick = 0.006) { // flat tapered strip (hair lock, leaf, ear)
    const curve = new THREE.CatmullRomCurve3(points), n = 14, pos = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, c = curve.getPointAt(t), T = curve.getTangentAt(t);
      let S = V3().crossVectors(T, V3(0, 0, 1)); if (S.lengthSq() < 1e-6) S.set(1, 0, 0); S.normalize();
      const w = width(t), N = V3().crossVectors(S, T).normalize();
      for (const [a, b] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) { const q = c.clone().addScaledVector(S, a * w).addScaledVector(N, b * thick); pos.push(q.x, q.y, q.z); }
    }
    for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) { const a = i * 4 + j, b = i * 4 + (j + 1) % 4, c = a + 4, d = b + 4; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }

  // ------------------------------------------------------------ figure builder
  class Builder {
    constructor(hitU) { this.parts = new Map(); this.hitU = hitU; this.meshes = []; }
    joint(parent, x, y, z, name) { const j = new THREE.Object3D(); j.position.set(x, y, z); j.name = name || ""; parent.add(j); return j; }
    // geometry placed in joint space with optional transform, coloured, outlined
    add(joint, geo, color, o = {}) {
      let g = geo.index ? geo.toNonIndexed() : geo.clone();
      for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
      const m = new THREE.Matrix4().compose(V3(...(o.pos || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot || [0, 0, 0]))), V3(...(o.scale ? [].concat(o.scale).length === 1 ? [o.scale, o.scale, o.scale] : o.scale : [1, 1, 1])));
      g.applyMatrix4(m);
      const c = new THREE.Color(color), col = new Float32Array(g.attributes.position.count * 3);
      for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const key = joint.uuid + (o.outline === false ? ":n" : ":o");
      if (!this.parts.has(key)) this.parts.set(key, { joint, list: [], outline: o.outline !== false, width: o.width || 0.008 });
      this.parts.get(key).list.push(g);
    }
    finish() {
      for (const { joint, list, outline, width } of this.parts.values()) {
        const g = mergeGeometries(list); g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, bodyMaterial(this.hitU)); joint.add(mesh); this.meshes.push(mesh);
        if (outline) { const o = new THREE.Mesh(g, outlineMaterial(width)); joint.add(o); this.meshes.push(o); }
      }
    }
  }

  // ------------------------------------------------------------ faces
  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  // Humanoid face, painted in head-local units over x -1..1, y 1..-1 (head radius 1)
  function humanFace(spec, expr) {
    return canvasTex(512, 512, (g) => {
      const X = (x) => (x + 1) * 256, Y = (y) => (1 - y) * 256, L = (m) => m * 256;
      g.fillStyle = hex(spec.skin); g.fillRect(0, 0, 512, 512);
      g.lineCap = "round"; g.lineJoin = "round";
      const ink = "#24150d", eye = spec.eye || 0x7c7524;
      for (const s of [-1, 1]) {
        const cx = s * 0.36, cy = -0.12;
        // blush
        const gr = g.createRadialGradient(X(s * 0.5), Y(-0.42), 0, X(s * 0.5), Y(-0.42), L(0.16));
        gr.addColorStop(0, "rgba(235,120,105,.35)"); gr.addColorStop(1, "rgba(235,120,105,0)"); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
        // brow
        const fierce = expr === "fierce";
        g.strokeStyle = ink; g.lineWidth = L(0.05);
        g.beginPath(); g.moveTo(X(s * 0.14), Y(fierce ? 0.08 : 0.16)); g.lineTo(X(s * 0.56), Y(fierce ? 0.24 : 0.2)); g.stroke();
        if (expr === "closed" || expr === "hurt") {
          g.lineWidth = L(0.045); g.beginPath();
          if (expr === "hurt") { g.moveTo(X(cx + s * 0.16), Y(cy + 0.1)); g.lineTo(X(cx - s * 0.14), Y(cy)); g.lineTo(X(cx + s * 0.16), Y(cy - 0.1)); }
          else { g.moveTo(X(cx - s * 0.18), Y(cy)); g.quadraticCurveTo(X(cx), Y(cy - 0.08), X(cx + s * 0.2), Y(cy + 0.02)); }
          g.stroke(); continue;
        }
        const lid = fierce ? 0.35 : 0.12;
        g.save(); g.beginPath(); g.ellipse(X(cx), Y(cy), L(0.18), L(0.21), 0, 0, TAU); g.clip();
        g.fillStyle = "#f6f1e8"; g.fillRect(0, 0, 512, 512);
        const ig = g.createLinearGradient(0, Y(cy + 0.2), 0, Y(cy - 0.2));
        const c = new THREE.Color(eye);
        ig.addColorStop(0, "#1c140a"); ig.addColorStop(0.55, "#" + c.getHexString()); ig.addColorStop(1, "#" + c.clone().offsetHSL(0, 0, 0.25).getHexString());
        g.fillStyle = ig; g.beginPath(); g.ellipse(X(cx + s * 0.02), Y(cy - 0.02), L(0.13), L(0.17), 0, 0, TAU); g.fill();
        g.fillStyle = "#120b05"; g.beginPath(); g.ellipse(X(cx + s * 0.02), Y(cy - 0.02), L(0.05), L(0.08), 0, 0, TAU); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(X(cx - s * 0.03), Y(cy + 0.07), L(0.04), 0, TAU); g.fill();
        g.fillStyle = hex(spec.skin); g.fillRect(X(cx - 0.3), Y(cy + 0.3), L(0.6), L(0.1 + 0.4 * lid));
        g.restore();
        g.fillStyle = ink; g.beginPath();
        g.moveTo(X(cx - s * 0.2), Y(cy + 0.08 - 0.4 * lid)); g.quadraticCurveTo(X(cx), Y(cy + 0.24 - 0.4 * lid), X(cx + s * 0.24), Y(cy + 0.1 - 0.35 * lid));
        g.lineTo(X(cx + s * 0.3), Y(cy + 0.16 - 0.35 * lid)); g.lineTo(X(cx + s * 0.18), Y(cy + 0.04 - 0.35 * lid));
        g.quadraticCurveTo(X(cx), Y(cy + 0.17 - 0.4 * lid), X(cx - s * 0.18), Y(cy + 0.03 - 0.4 * lid)); g.closePath(); g.fill();
      }
      g.strokeStyle = "#6e332b"; g.lineWidth = L(0.035);
      g.beginPath();
      if (expr === "fierce") { g.fillStyle = "#5a221d"; g.moveTo(X(-0.1), Y(-0.52)); g.lineTo(X(0.12), Y(-0.5)); g.lineTo(X(0.02), Y(-0.62)); g.closePath(); g.fill(); g.stroke(); }
      else if (expr === "hurt") { for (let i = 0; i <= 6; i++) g.lineTo(X(-0.1 + i * 0.034), Y(-0.54 + (i % 2 ? 0.02 : -0.02))); g.stroke(); }
      else { g.moveTo(X(-0.07), Y(-0.54)); g.quadraticCurveTo(X(0.02), Y(-0.56), X(0.08), Y(-0.51)); g.stroke(); }
    });
  }

  // ------------------------------------------------------------ humanoid
  function humanoid(spec, B) {
    const J = {}, S = spec, root = new THREE.Group();
    J.root = B.joint(root, 0, 0.34, 0, "root");
    const P = S.palette;
    // legs
    for (const s of [1, -1]) {
      const L = s > 0 ? "L" : "R";
      const hip = J["hip" + L] = B.joint(J.root, s * 0.065, -0.02, 0);
      B.add(hip, lathe([[0, 0.02], [0.058, 0.01], [0.052, -0.09], [0.046, -0.16], [0, -0.17]]), P.legs);
      const kn = J["kn" + L] = B.joint(hip, 0, -0.16, 0);
      B.add(kn, lathe([[0, 0.02], [0.05, 0.01], [0.052, -0.05], [0.042, -0.14], [0, -0.15]]), P.boots);
      B.add(kn, new THREE.TorusGeometry(0.052, 0.01, 6, 20), P.trim, { pos: [0, -0.01, 0], rot: [Math.PI / 2, 0, 0] });
      const an = J["an" + L] = B.joint(kn, 0, -0.15, 0);
      B.add(an, new THREE.CapsuleGeometry(0.042, 0.06, 4, 10), P.boots, { pos: [0, -0.02, 0.03], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.75] });
    }
    // pelvis, skirt, torso
    B.add(J.root, lathe([[0, -0.06], [0.1, -0.05], [0.115, 0.02], [0.1, 0.07], [0, 0.07]]), P.legs, { scale: [1, 1, 0.8] });
    B.add(J.root, new THREE.CylinderGeometry(0.11, 0.16, 0.14, 18, 1, true), P.skirt || P.top, { pos: [0, -0.06, 0], scale: [1, 1, 0.82] });
    B.add(J.root, new THREE.TorusGeometry(0.108, 0.016, 6, 24), P.belt, { pos: [0, 0.035, 0], rot: [Math.PI / 2, 0, 0], scale: [1, 0.8, 1] });
    J.chest = B.joint(J.root, 0, 0.07, 0, "chest");
    B.add(J.chest, lathe([[0, 0], [0.1, 0], [0.12, 0.08], [0.115, 0.15], [0.07, 0.19], [0, 0.2]]), P.top, { scale: [1, 1, 0.78] });
    if (S.bodice) B.add(J.chest, lathe([[0, 0.0], [0.104, 0.0], [0.122, 0.08], [0, 0.085]]), S.bodice, { scale: [1, 1, 0.8], outline: false });
    // cape hanging from the shoulders
    if (P.cape) {
      const cape = J.cape = B.joint(J.chest, 0, 0.17, -0.05, "cape");
      const g = new THREE.CylinderGeometry(0.13, 0.26, 0.5, 20, 6, true, Math.PI * 0.62, Math.PI * 0.76);
      g.translate(0, -0.25, 0); B.add(cape, g, P.cape, { scale: [1, 1, 0.7] });
    }
    // arms
    for (const s of [1, -1]) {
      const L = s > 0 ? "L" : "R";
      const sh = J["sh" + L] = B.joint(J.chest, s * 0.12, 0.15, 0);
      B.add(sh, new THREE.SphereGeometry(0.052, 14, 10), P.top);
      B.add(sh, lathe([[0, 0.01], [0.042, 0], [0.038, -0.1], [0, -0.11]]), P.sleeve || P.top);
      const el = J["el" + L] = B.joint(sh, 0, -0.105, 0);
      B.add(el, lathe([[0, 0], [0.036, -0.005], [0.032, -0.09], [0, -0.1]]), P.gloves || P.skinArm || S.skin);
      const wr = J["wr" + L] = B.joint(el, 0, -0.1, 0);
      B.add(wr, new THREE.SphereGeometry(0.036, 12, 8), P.gloves || S.skin, { pos: [0, -0.025, 0], scale: [0.9, 1.1, 1] });
    }
    // head
    J.neck = B.joint(J.chest, 0, 0.2, 0, "neck");
    B.add(J.neck, new THREE.CylinderGeometry(0.035, 0.04, 0.06, 10), S.skin, { outline: false });
    J.head = B.joint(J.neck, 0, 0.03, 0, "head");
    const R = 0.25, HC = [0, 0.22, 0.01];
    const headG = new THREE.SphereGeometry(R, 32, 24);
    { const p = headG.attributes.position, uv = headG.attributes.uv; for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y < 0) { const q = Math.pow(-y / R, 1.5); x *= 1 - 0.22 * q; z *= 1 - 0.12 * q; }
        z *= 0.92; p.setXYZ(i, x, y, z);
        uv.setXY(i, z > 0 ? (x / R + 1) / 2 : 0.01, z > 0 ? (y / R + 1) / 2 : 0.99);
      } headG.computeVertexNormals(); }
    const faces = { open: humanFace(S, "open"), closed: humanFace(S, "closed"), fierce: humanFace(S, "fierce"), hurt: humanFace(S, "hurt") };
    const faceMat = mapMaterial(faces.open, B.hitU);
    const head = new THREE.Mesh(headG, faceMat); head.position.set(...HC); J.head.add(head);
    const hO = new THREE.Mesh(headG, outlineMaterial(0.008)); hO.position.set(...HC); J.head.add(hO);
    B.meshes.push(head, hO);
    // ears (elf)
    if (S.elf) for (const s of [1, -1]) B.add(J.head, new THREE.ConeGeometry(0.035, 0.16, 8), S.skin, { pos: [s * 0.25, 0.22, -0.03], rot: [0.2, 0, -s * 1.05], scale: [1, 1, 0.45] });
    // hair: cap + back mass + bangs
    const H = P.hair;
    const cap = new THREE.SphereGeometry(R * 1.07, 28, 16, 0, TAU, 0, 1.25);
    B.add(J.head, cap, H, { pos: HC, scale: [1, 1, 0.97] });
    const back = new THREE.SphereGeometry(R * 1.05, 24, 14, Math.PI * 0.95, Math.PI * 1.1, 0.9, 1.6);
    B.add(J.head, back, H, { pos: [0, HC[1] - 0.02, HC[2] - 0.02], scale: [1.02, 1.25, 1] });
    for (let i = 0; i < 7; i++) {
      const u = i / 6 * 2 - 1, x0 = u * 0.19;
      B.add(J.head, blade([V3(x0 * 0.6, 0.43, 0.12), V3(x0 * 1.02, 0.34, 0.225), V3(x0 * 1.15 + 0.012 * Math.sign(u), 0.24 + 0.05 * Math.abs(u), 0.23 - 0.05 * Math.abs(u))], (t) => 0.05 * (1 - t) + 0.004), H, { width: 0.005 });
    }
    if (S.longHair) for (const s of [1, -1]) B.add(J.head, blade([V3(s * 0.25, 0.3, -0.02), V3(s * 0.28, 0.12, -0.05), V3(s * 0.27, -0.06, -0.08), V3(s * 0.3, -0.18, -0.12)], (t) => 0.06 * (1 - 0.7 * t)), H, { width: 0.005 });
    // hood
    if (S.hood) {
      const hood = new THREE.SphereGeometry(R * 1.22, 26, 16, Math.PI * 0.62 + Math.PI / 2, TAU - Math.PI * 1.24, 0, 2.15);
      B.add(J.head, hood, S.hood, { pos: [0, HC[1] + 0.01, HC[2] - 0.02], scale: [1, 1.02, 1] });
      B.add(J.head, new THREE.ConeGeometry(0.07, 0.16, 10), S.hood, { pos: [0, HC[1] + 0.12, -0.28], rot: [-2.2, 0, 0] });
    }
    // weapon in the right hand
    const W = J.weapon = B.joint(J.wrR, -0.01, -0.03, 0.02, "weapon");
    if (S.weapon === "spear") {
      B.add(W, new THREE.CylinderGeometry(0.012, 0.012, 0.8, 8), P.wood, { pos: [0, 0.18, 0] });
      B.add(W, new THREE.ConeGeometry(0.035, 0.15, 4), P.metal, { pos: [0, 0.65, 0], scale: [1, 1, 0.35] });
      B.add(W, new THREE.TorusGeometry(0.018, 0.008, 6, 12), P.trim, { pos: [0, 0.56, 0], rot: [Math.PI / 2, 0, 0] });
      for (const s of [1, -1]) B.add(W, blade([V3(0, 0.57, 0), V3(s * 0.04, 0.52, 0.02), V3(s * 0.05, 0.44, 0.03)], (t) => 0.014 * (1 - t) + 0.002), P.accent || P.trim, { outline: false });
    }
    return { root, J, head, faceMat, faces, kind: "humanoid" };
  }

  // ------------------------------------------------------------ quadruped
  function quadruped(spec, B) {
    const J = {}, S = spec, P = S.palette, root = new THREE.Group();
    const leg = S.legLength || 0.22, bodyL = S.bodyLength || 0.34, bodyR = S.bodyRadius || 0.13;
    J.root = B.joint(root, 0, leg + bodyR * 0.55, 0, "root");
    // torso along +X (forward)
    J.body = B.joint(J.root, 0, 0, 0, "body");
    B.add(J.body, new THREE.CapsuleGeometry(bodyR, bodyL, 6, 16), P.body, { rot: [0, 0, Math.PI / 2], scale: [1, 1, 0.92] });
    B.add(J.body, new THREE.SphereGeometry(bodyR * 0.95, 16, 12), P.belly || P.body, { pos: [0.04, -0.035, 0], scale: [1.3, 0.8, 0.8] });
    B.add(J.body, new THREE.SphereGeometry(bodyR * 1.12, 16, 12), P.body, { pos: [bodyL * 0.38, 0.02, 0], scale: [1, 1.05, 0.95] });
    if (S.ruff) for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; B.add(J.body, new THREE.IcosahedronGeometry(0.05, 0), P.ruff || P.body, { pos: [bodyL * 0.42 + 0.02 * Math.cos(a), 0.03 + 0.09 * Math.sin(a), 0.1 * Math.cos(a * 1.5)], scale: [1, 1.3, 1] }); }
    if (S.marks) for (const [x, y, z] of [[0.05, 0.07, 0.12], [-0.08, 0.05, 0.12], [0.05, 0.07, -0.12], [-0.08, 0.05, -0.12]]) B.add(J.body, new THREE.TorusGeometry(0.035, 0.008, 6, 14, Math.PI * 1.3), S.marks, { pos: [x, y, z], outline: false });
    // legs: front pair at +X, back pair at -X
    for (const [key, x, z] of [["FL", 1, 1], ["FR", 1, -1], ["BL", -1, 1], ["BR", -1, -1]]) {
      const hind = x < 0, th = S.legThick || 1;
      const hip = J["hip" + key] = B.joint(J.body, x * bodyL * 0.45, -bodyR * 0.25, z * bodyR * 0.55);
      B.add(hip, lathe([[0, 0.04], [0.062 * th, 0.02], [0.058 * th, -leg * 0.18], [0.036 * th, -leg * 0.5], [0, -leg * 0.53]]), P.body, { scale: [hind ? 1.25 : 1, 1, 0.9] });
      const kn = J["kn" + key] = B.joint(hip, 0, -leg * 0.5, 0);
      B.add(kn, lathe([[0, 0.01], [0.028 * th, 0], [0.024 * th, -leg * 0.46], [0, -leg * 0.5]]), P.legs || P.body);
      B.add(kn, new THREE.SphereGeometry(0.036 * th, 12, 8), P.paws || P.legs || P.body, { pos: [0.014, -leg * 0.5, 0], scale: [1.35, 0.7, 1] });
      hip.rotation.z = hind ? 0.32 : -0.05; kn.rotation.z = hind ? -0.55 : 0.08;
    }
    // neck and head (big)
    J.neck = B.joint(J.body, bodyL * 0.55, bodyR * 0.4, 0, "neck");
    B.add(J.neck, new THREE.CylinderGeometry(0.06, 0.09, S.neckLength || 0.12, 12), P.body, { pos: [0.02, (S.neckLength || 0.12) / 2, 0], rot: [0, 0, -0.35] });
    J.head = B.joint(J.neck, 0.06, S.neckLength || 0.12, 0, "head");
    const HR = S.headRadius || 0.15;
    B.add(J.head, new THREE.SphereGeometry(HR, 20, 16), P.head || P.body, { pos: [0.03, 0.04, 0], scale: [1.05, 0.95, 1] });
    // snout, nose, jaw
    J.jaw = B.joint(J.head, 0.1, -0.02, 0, "jaw");
    B.add(J.head, new THREE.CapsuleGeometry(HR * 0.4, HR * 0.45, 4, 12), P.snout || P.head || P.body, { pos: [HR * 0.98, -0.045, 0], rot: [0, 0, Math.PI / 2], scale: [1, 0.85, 1] });
    B.add(J.head, new THREE.SphereGeometry(HR * 0.18, 10, 8), 0x1a1210, { pos: [HR * 1.6, -0.02, 0], outline: false });
    B.add(J.jaw, new THREE.CapsuleGeometry(HR * 0.26, HR * 0.36, 4, 10), P.belly || P.body, { pos: [HR * 0.75, -0.085, 0], rot: [0, 0, Math.PI / 2] });
    // eyes: big glossy, on both sides of the face
    for (const z of [1, -1]) {
      // eyes on the front of the face, above the snout (chibi: big, close together)
      const ex = HR * 0.78 + 0.03, ey = 0.1, ez = z * HR * 0.42;
      B.add(J.head, new THREE.SphereGeometry(HR * 0.26, 14, 10), 0x121016, { pos: [ex, ey, ez], scale: [0.45, 1.1, 0.95], outline: false });
      B.add(J.head, new THREE.SphereGeometry(HR * 0.19, 12, 8), S.eye || 0x8fd0ff, { pos: [ex + 0.012, ey - 0.008, ez], scale: [0.45, 1.05, 0.95], outline: false });
      B.add(J.head, new THREE.SphereGeometry(HR * 0.1, 10, 8), 0x0b0a10, { pos: [ex + 0.02, ey - 0.006, ez], scale: [0.45, 1.2, 0.8], outline: false });
      B.add(J.head, new THREE.SphereGeometry(HR * 0.075, 8, 6), 0xffffff, { pos: [ex + 0.028, ey + 0.03, ez + z * 0.012], outline: false });
      if (S.ears) B.add(J.head, new THREE.ConeGeometry(HR * 0.35, HR * 0.9, 4), P.ears || P.head || P.body, { pos: [-0.01, HR + 0.05, z * HR * 0.55], rot: [z * 0.35, 0, -0.2], scale: [1, 1, 0.55] });
    }
    if (S.antlers) for (const z of [1, -1]) {
      const a = J["antler" + (z > 0 ? "L" : "R")] = B.joint(J.head, 0, HR * 0.85, z * HR * 0.45);
      B.add(a, tube([V3(0, 0, 0), V3(-0.03, 0.12, z * 0.06), V3(-0.08, 0.26, z * 0.1), V3(-0.06, 0.4, z * 0.16)], 0.018, 0.008), S.antlers);
      for (const [t, dx, dy] of [[0.35, 0.08, 0.09], [0.6, 0.07, 0.1], [0.82, -0.08, 0.08]]) {
        const base = new THREE.CatmullRomCurve3([V3(0, 0, 0), V3(-0.03, 0.12, z * 0.06), V3(-0.08, 0.26, z * 0.1), V3(-0.06, 0.4, z * 0.16)]).getPointAt(t);
        B.add(a, tube([base, base.clone().add(V3(dx * 0.6, dy * 0.6, z * 0.01)), base.clone().add(V3(dx, dy, z * 0.02))], 0.011, 0.004, 6, 6), S.antlers);
      }
    }
    // tail
    J.tail = B.joint(J.body, -bodyL * 0.58, bodyR * 0.3, 0, "tail");
    const tl = S.tailLength || 0.2;
    if (S.tail === "bushy") B.add(J.tail, new THREE.CapsuleGeometry(0.05, tl, 6, 10), P.tail || P.body, { pos: [-tl * 0.45, tl * 0.25, 0], rot: [0, 0, 1.0], scale: [1, 1, 0.9] });
    else B.add(J.tail, new THREE.ConeGeometry(0.035, tl * 0.6, 8), P.tail || P.body, { pos: [-tl * 0.2, tl * 0.2, 0], rot: [0, 0, 0.9] });
    return { root, J, kind: "quadruped" };
  }

  // ------------------------------------------------------------ build + clips
  function build(spec) {
    const hitU = { value: 0 };
    const B = new Builder(hitU);
    const fig = spec.body === "quadruped" ? quadruped(spec, B) : humanoid(spec, B);
    B.finish();
    fig.meshes = B.meshes; fig.hitU = hitU; fig.spec = spec;
    fig.root.scale.setScalar(spec.scale || 1);
    // rest pose snapshot for clips
    fig.rest = new Map();
    fig.root.traverse((o) => fig.rest.set(o, { p: o.position.clone(), q: o.quaternion.clone() }));
    return fig;
  }
  const E = new THREE.Euler(), Q = new THREE.Quaternion();
  function rot(o, fig, x, y, z) { const r = fig.rest.get(o); if (!r) return; E.set(x, y, z); o.quaternion.copy(r.q).multiply(Q.setFromEuler(E)); }
  function off(o, fig, x, y, z) { const r = fig.rest.get(o); if (!r) return; o.position.copy(r.p).add(V3(x, y, z)); }

  /* Pose the figure for time t (s since start) of clip c ("idle" loops;
   * others run once: attack 0.9 s with contact at 0.42, hurt 0.6, death 1.2,
   * spawn 0.6). Returns true while the clip is running. */
  function pose(fig, clip, t, T) {
    const J = fig.J, s = fig.spec;
    const br = Math.sin(T * TAU / (s.body === "quadruped" ? 1.6 : 3.2));
    let face = "open";
    // clear to rest + idle
    for (const [o, r] of fig.rest) if (o !== fig.root) { o.position.copy(r.p); o.quaternion.copy(r.q); }
    let alpha = 1, running = true;
    if (fig.kind === "humanoid") {
      rot(J.chest, fig, 0.03 * br, 0.05 * Math.sin(T * 0.7), 0);
      rot(J.head, fig, 0.03 * Math.sin(T * 0.9), 0.12 * Math.sin(T * 0.45), 0.03 * Math.sin(T * 0.6));
      rot(J.shL, fig, -0.1, 0, 0.15 + 0.03 * br); rot(J.elL, fig, -0.4, 0, 0);
      rot(J.shR, fig, -0.1, 0, -0.62); rot(J.elR, fig, -1.1, 0, 0.3); rot(J.weapon, fig, Math.PI / 2 + 0.1, 0, 0.85);
      off(J.root, fig, 0, 0.006 * br, 0);
      if (J.cape) rot(J.cape, fig, 0.12 + 0.05 * Math.sin(T * 1.7), 0, 0.03 * Math.sin(T * 1.3));
      if (clip === "attack") {
        // wind up, lunge and thrust at 0.42, recover
        const up = sstep(0, 0.3, t) * (1 - sstep(0.36, 0.44, t)), th = sstep(0.34, 0.44, t) * (1 - sstep(0.62, 0.9, t));
        const lvl = sstep(0.05, 0.32, t) * (1 - sstep(0.62, 0.9, t));
        rot(J.chest, fig, 0.2 * th - 0.1 * up, 0.5 * up - 0.3 * th, 0);
        rot(J.shR, fig, -0.1 - 0.5 * up - 1.4 * th, 0, -0.28 - 0.25 * up + 0.2 * th);
        rot(J.elR, fig, -1.15 - 0.2 * up + 1.15 * th, 0, 0);
        rot(J.weapon, fig, Math.PI / 2 + 0.1 + (Math.PI / 2 - 0.1) * lvl, 0, 0.85 * (1 - lvl));
        rot(J.hipL, fig, -0.6 * th, 0, 0); rot(J.knL, fig, 0.5 * th, 0, 0); rot(J.hipR, fig, 0.4 * th, 0, 0);
        off(J.root, fig, 0, -0.04 * up - 0.02 * th, 0.06 * th);
        face = t > 0.15 && t < 0.8 ? "fierce" : "open";
        running = t < 0.9;
      } else if (clip === "hurt") {
        const k = Math.exp(-t * 6) * sstep(0, 0.05, t);
        rot(J.chest, fig, -0.35 * k, 0, 0.2 * k); rot(J.head, fig, -0.3 * k, 0, 0.2 * k);
        rot(J.shL, fig, -0.1, 0, 0.15 + 0.6 * k); rot(J.shR, fig, -0.25 - 0.4 * k, 0, -0.18 - 0.6 * k);
        off(J.root, fig, 0, -0.03 * k, -0.06 * k);
        face = t < 0.45 ? "hurt" : "open"; running = t < 0.6;
      } else if (clip === "death") {
        const k = sstep(0, 0.7, t);
        rot(J.root, fig, -1.35 * k, 0, 0.2 * k); off(J.root, fig, 0, -0.26 * k, -0.1 * k);
        rot(J.head, fig, -0.3 * k, 0, 0); rot(J.shL, fig, 0, 0, 1.2 * k); rot(J.shR, fig, 0, 0, -1.2 * k);
        face = "closed"; alpha = 1 - sstep(0.75, 1.2, t); running = t < 1.2;
      }
      if (fig.face !== face) { fig.face = face; fig.faceMat.map = fig.faces[face]; }
    } else {
      rot(J.body, fig, 0, 0, 0.015 * br);
      rot(J.head, fig, 0.06 * Math.sin(T * 0.8), 0.15 * Math.sin(T * 0.5), -0.05 + 0.04 * br);
      rot(J.tail, fig, 0.5 * Math.sin(T * (s.wag || 5)), 0, 0.1 * Math.sin(T * 2));
      if (clip === "attack") {
        // crouch, pounce forward (+X) with the jaw open at 0.42, land
        const cr = sstep(0, 0.28, t) * (1 - sstep(0.3, 0.4, t)), air = sstep(0.28, 0.42, t) * (1 - sstep(0.5, 0.85, t));
        rot(J.body, fig, 0, 0, 0.25 * cr - 0.2 * air);
        off(J.root, fig, 0.18 * air, -0.06 * cr + 0.1 * air * (1 - sstep(0.42, 0.6, t)), 0);
        rot(J.head, fig, 0, 0, -0.35 * air);
        rot(J.jaw, fig, 0, 0, -0.6 * air);
        for (const k of ["FL", "FR"]) { rot(J["hip" + k], fig, 0, 0, 0.9 * air - 0.3 * cr); rot(J["kn" + k], fig, 0, 0, -0.6 * cr); }
        for (const k of ["BL", "BR"]) { rot(J["hip" + k], fig, 0, 0, -0.7 * air + 0.4 * cr); rot(J["kn" + k], fig, 0, 0, 0.5 * cr); }
        if (J.antlerL) { rot(J.head, fig, 0, 0, -0.6 * air - 0.2 * cr); }
        running = t < 0.9;
      } else if (clip === "hurt") {
        const k = Math.exp(-t * 6) * sstep(0, 0.05, t);
        rot(J.body, fig, 0.2 * k, 0, 0.15 * k); rot(J.head, fig, 0.3 * k, 0, 0.35 * k); off(J.root, fig, -0.07 * k, 0.02 * k, 0);
        running = t < 0.6;
      } else if (clip === "death") {
        const k = sstep(0, 0.6, t);
        rot(J.root, fig, 1.4 * k, 0, 0); off(J.root, fig, 0, -0.2 * k, 0);
        for (const kk of ["FL", "FR", "BL", "BR"]) rot(J["hip" + kk], fig, 0, 0, 0.4 * k);
        alpha = 1 - sstep(0.75, 1.2, t); running = t < 1.2;
      }
    }
    if (clip === "spawn") {
      const k = Math.min(1, t / 0.6), s0 = 1 + Math.sin(k * Math.PI * 2.5) * (1 - k) * 0.35;
      fig.root.scale.setScalar((fig.spec.scale || 1) * (k < 0.15 ? k / 0.15 : 1) * s0);
      running = t < 0.6;
    } else fig.root.scale.setScalar(fig.spec.scale || 1);
    if (fig.alpha !== alpha) { fig.alpha = alpha; for (const m of fig.meshes) m.material.opacity = alpha; }
    return running;
  }

  function dispose(fig) {
    const seen = new Set();
    fig.root.traverse((o) => { if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); } if (o.material) o.material.dispose(); });
    if (fig.faces) for (const t of Object.values(fig.faces)) t.dispose();
  }

  return Object.freeze({ build, pose, dispose });
})();
