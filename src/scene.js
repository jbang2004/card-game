/* ATELIER EDITION. Optional Three.js r160 renderer, calibrated to the 1600 × 940
 * interaction plane. Canvas world + VFX remain independent and fully offline.
 * Geometry is projected from the same screen coordinates as the DOM targets:
 * changing quality never changes card positions or game rules. */
const EmberScene = (() => {
  "use strict";
  let T,
    renderer,
    scene,
    camera,
    root,
    active = false,
    view = "lobby",
    reduced = false,
    low = false,
    last = 0,
    raf = 0,
    theme = 0,
    phase = false;
  const tokens = new Map(),
    bursts = [],
    gems = [],
    rings = [];
  const palette = [0xd49b68, 0x92bfa3, 0xb197d4, 0x8fcadd, 0xe5a171];
  function status(s) {
    document.getElementById("engine-status").textContent = s;
  }
  function material(color, metalness = 0.3, roughness = 0.6) {
    return new T.MeshStandardMaterial({ color, metalness, roughness });
  }
  function mesh(geometry, mat, parent = root) {
    const m = new T.Mesh(geometry, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function dispose(o) {
    o.traverse((n) => {
      n.geometry?.dispose();
      if (n.material) {
        const mats = Array.isArray(n.material) ? n.material : [n.material];
        for (const m of mats) {
          m.map?.dispose();
          m.dispose();
        }
      }
    });
  }
  function world(x, y, h = 0.18) {
    const p = new T.Vector3(x / 800 - 1, 1 - y / 470, 0.5).unproject(camera),
      d = p.sub(camera.position).normalize();
    return camera.position
      .clone()
      .add(d.multiplyScalar((h - camera.position.y) / d.y));
  }
  function slab(points, depth, top, mat, bevel = 0.022) {
    const shape = new T.Shape();
    points.forEach(([x, y], i) => {
      const p = world(x, y, top);
      i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z);
    });
    shape.closePath();
    const g = new T.ExtrudeGeometry(shape, {
      depth,
      steps: 1,
      bevelEnabled: !!bevel,
      bevelSegments: 3,
      bevelSize: bevel,
      bevelThickness: bevel,
    });
    const a = g.attributes.position,
      u = g.attributes.uv;
    g.computeBoundingBox();
    const b = g.boundingBox;
    for (let i = 0; i < a.count; i++)
      u.setXY(
        i,
        (a.getX(i) - b.min.x) / (b.max.x - b.min.x),
        (a.getY(i) - b.min.y) / (b.max.y - b.min.y),
      );
    const m = mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = top - depth;
    return m;
  }
  function outline(points, color, opacity = 0.5, h = 0.225) {
    const ps = points.map(([x, y]) => world(x, y, h));
    ps.push(ps[0].clone());
    const g = new T.BufferGeometry().setFromPoints(ps),
      m = new T.LineBasicMaterial({ color, transparent: true, opacity });
    const line = new T.Line(g, m);
    root.add(line);
    return line;
  }
  function slate() {
    const c = document.createElement("canvas");
    c.width = 1536;
    c.height = 768;
    const x = c.getContext("2d");
    const grad = x.createRadialGradient(768, 384, 0, 768, 384, 870);
    grad.addColorStop(0, "#e7d7ad");
    grad.addColorStop(1, "#c5a56b");
    x.fillStyle = grad;
    x.fillRect(0, 0, c.width, c.height);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    const img = new Image();
    img.onload = () => {
      x.drawImage(img, 0, 0, c.width, c.height);
      t.needsUpdate = true;
    };
    img.src = AtelierAssets["table-surface"];
    return t;
  }
  function board() {
    // Same projected contour as the painted Canvas tabletop. Architecture stays
    // in separate painted layers; only central slabs and token bases use WebGL.
    const topPoints = [
      [238, 294],
      [333, 277],
      [455, 250],
      [580, 223],
      [691, 202],
      [738, 186],
      [800, 181],
      [862, 186],
      [909, 202],
      [1020, 223],
      [1145, 250],
      [1267, 277],
      [1362, 294],
      [1383, 320],
      [1392, 372],
      [1390, 532],
      [1378, 583],
      [1360, 605],
      [1257, 630],
      [1145, 658],
      [1026, 684],
      [919, 711],
      [860, 728],
      [800, 733],
      [740, 728],
      [681, 711],
      [574, 684],
      [455, 658],
      [343, 630],
      [240, 605],
      [220, 583],
      [209, 531],
      [208, 375],
      [217, 320],
    ];
    const scaled = (a, sx, sy, dy = 0) =>
      a.map(([x, y]) => [800 + (x - 800) * sx, 457 + (y - 457) * sy + dy]);
    slab(
      scaled(topPoints, 1.035, 1.065, 5),
      0.31,
      -0.08,
      material(0x4e3827, 0.16, 0.76),
      0.035,
    );
    slab(
      scaled(topPoints, 1.018, 1.033),
      0.12,
      0.09,
      material(0xb18d53, 0.45, 0.47),
      0.024,
    );
    const mat = material(0xffffff, 0.03, 0.97);
    mat.map = slate();
    mat.bumpMap = mat.map;
    mat.bumpScale = 0.005;
    slab(topPoints, 0.08, 0.19, mat, 0.013);
    outline(topPoints, 0xe7c890, 0.58);
    outline(scaled(topPoints, 0.985, 0.975), 0x9a7848, 0.23);
    outline(
      [
        [238, 433],
        [1367, 433],
      ],
      0x937348,
      0.22,
      0.235,
    );
    for (const [x, y] of [
      [326, 309],
      [1277, 309],
      [326, 590],
      [1277, 590],
    ]) {
      const pos = world(x, y, 0.23),
        g = new T.Group();
      g.position.copy(pos);
      root.add(g);
      const gem = mesh(
        new T.OctahedronGeometry(0.025),
        new T.MeshStandardMaterial({
          color: palette[theme],
          emissive: palette[theme],
          emissiveIntensity: 0.24,
          metalness: 0.6,
          roughness: 0.3,
        }),
        g,
      );
      gem.position.y = 0.05;
      gem.scale.y = 0.35;
      const light = new T.PointLight(palette[theme], 0.28, 1.5, 2);
      light.position.set(0, 0.4, 0);
      g.add(light);
      gems.push({ gem, light, seed: x + y });
    }
  }
  function sync(s) {
    if (!active || !s) return;
    const ids = new Set();
    for (const side of ["p", "e"])
      s[side].board.forEach((m, i) => {
        ids.add(m.uid);
        const p = world(
          800 + (i - (s[side].board.length - 1) / 2) * 128,
          (side === "p" ? 507 : 354) + 48,
          0.27,
        );
        let g = tokens.get(m.uid);
        if (!g) {
          g = new T.Group();
          root.add(g);
          const metal = material(
              side === "p" ? 0xb3a075 : 0x997458,
              0.76,
              0.32,
            ),
            base = mesh(new T.CylinderGeometry(0.5, 0.56, 0.08, 40), metal, g);
          base.scale.z = 0.69;
          const inset = mesh(
            new T.CylinderGeometry(0.45, 0.47, 0.085, 40),
            material(0x695c46, 0.18, 0.7),
            g,
          );
          inset.position.y = 0.04;
          inset.scale.z = 0.65;
          const rim = mesh(
            new T.TorusGeometry(0.49, 0.009, 6, 48),
            new T.MeshBasicMaterial({
              color: side === "p" ? 0xc2ddc3 : 0xc28f77,
              transparent: true,
              opacity: 0.6,
            }),
            g,
          );
          rim.rotation.x = Math.PI / 2;
          rim.position.y = 0.1;
          rim.scale.y = 0.67;
          g.position.copy(p);
          g.userData.rim = rim;
          tokens.set(m.uid, g);
        }
        g.userData.dest = p;
        g.userData.rim.material.opacity = m.sick
          ? 0.16
          : m.frozen
            ? 0.36
            : 0.62;
        g.visible = view === "battle";
      });
    for (const [id, g] of tokens)
      if (!ids.has(id)) {
        root.remove(g);
        dispose(g);
        tokens.delete(id);
      }
  }
  function burst(x, y, color = 0xe3b58c, count = 24) {
    if (!active || reduced || view !== "battle") return;
    count = Math.min(low ? 14 : 42, count);
    if (bursts.length > 12) return;
    const p = world(x, y, 0.5),
      a = new Float32Array(count * 3),
      v = [];
    for (let i = 0; i < count; i++) {
      a.set([p.x, p.y, p.z], i * 3);
      v.push({
        x: (Math.random() - 0.5) * 3,
        y: 1.2 + Math.random() * 2,
        z: (Math.random() - 0.5) * 2,
      });
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(a, 3));
    const points = new T.Points(
      g,
      new T.PointsMaterial({
        color,
        size: 0.026,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    root.add(points);
    bursts.push({ points, v, life: 0.8 });
  }
  function animate(t) {
    raf = requestAnimationFrame(animate);
    if (document.hidden || EmberViewport.mobile || t - last < (low ? 40 : 30))
      return;
    const dt = Math.min((t - last) / 1000, 0.05);
    last = t;
    root.visible = view === "battle";
    if (!root.visible) {
      renderer.clear();
      return;
    }
    const time = reduced ? 0 : t / 1000;
    for (const g of gems) {
      g.gem.rotation.y = time * 0.25;
      g.gem.position.y = 0.05 + Math.sin(time * 1.4 + g.seed) * 0.005;
      g.light.intensity =
        (phase ? 0.45 : 0.28) * (1 + Math.sin(time * 5 + g.seed) * 0.08);
    }
    for (const g of tokens.values())
      g.position.lerp(g.userData.dest, reduced ? 1 : 0.24);
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      const a = b.points.geometry.attributes.position;
      for (let j = 0; j < b.v.length; j++) {
        const v = b.v[j];
        v.y -= dt * 5;
        a.setXYZ(
          j,
          a.getX(j) + v.x * dt,
          a.getY(j) + v.y * dt,
          a.getZ(j) + v.z * dt,
        );
      }
      a.needsUpdate = true;
      b.points.material.opacity = Math.max(0, b.life);
      if (b.life <= 0) {
        root.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        bursts.splice(i, 1);
      }
    }
    renderer.render(scene, camera);
  }
  function setTheme(i, p = false) {
    theme = i;
    phase = p;
    for (const g of gems) {
      g.gem.material.color.setHex(palette[i] || palette[0]);
      g.gem.material.emissive.setHex(palette[i] || palette[0]);
      g.light.color.setHex(palette[i] || palette[0]);
    }
    for (const r of rings) r.material.color.setHex(palette[i] || palette[0]);
  }
  function quality(r, l) {
    reduced = !!r;
    low = !!l;
    if (renderer) {
      renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio || 1, 1.5));
      renderer.shadowMap.enabled = !low;
    }
  }
  function setView(v) {
    view = v;
    if (root) root.visible = v === "battle";
  }
  function init(lib) {
    if (active) return;
    try {
      T = lib;
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(1600, 940);
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.shadowMap.enabled = !low;
      renderer.shadowMap.type = T.PCFSoftShadowMap;
      document.getElementById("scene").appendChild(renderer.domElement);
      scene = new T.Scene();
      camera = new T.PerspectiveCamera(34, 1600 / 940, 0.1, 90);
      camera.position.set(0, 15.8, 16.8);
      camera.lookAt(0, 0, 0.8);
      camera.updateMatrixWorld(true);
      root = new T.Group();
      scene.add(root);
      scene.add(new T.HemisphereLight(0xffe7c2, 0x543e24, 2.1));
      const key = new T.DirectionalLight(0xffe6b5, 2.1);
      key.position.set(-6, 12, -4);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      Object.assign(key.shadow.camera, {
        left: -15,
        right: 15,
        top: 12,
        bottom: -12,
      });
      key.shadow.bias = -0.001;
      scene.add(key);
      const fill = new T.DirectionalLight(0x9ab9de, 0.85);
      fill.position.set(6, 4, 8);
      scene.add(fill);
      board();
      active = true;
      document.getElementById("app").classList.add("three-ready");
      status("THREE.JS · 3D 场景");
      quality(reduced, low);
      sync(window.Emberfall?.game?.s);
      animate(0);
    } catch (e) {
      console.warn(
        "3D unavailable; independent Canvas world and combat compositor stay active.",
        e,
      );
      cancelAnimationFrame(raf);
      renderer?.dispose();
      renderer?.domElement?.remove();
      if (root) dispose(root);
      active = false;
      document.getElementById("app").classList.remove("three-ready");
      status("2D 兼容模式 · 完整战斗特效");
    }
  }
  function load() {
    // The painted world is the production renderer. The inherited 3D board
    // duplicates its silhouette; retain it only as an explicit developer preview.
    if (new URLSearchParams(location.search).get("renderer") !== "three") {
      status("手绘山谷");
      return;
    }
    if (EmberViewport.mobile) {
      status("触屏布局 · Canvas");
      return;
    }
    if (active) return;
    status("载入 3D 场景…");
    const sources = [
      "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js",
      "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js",
    ];
    let index = 0;
    function next() {
      if (active) return;
      if (window.THREE) {
        init(window.THREE);
        return;
      }
      if (index >= sources.length) {
        status("2D 兼容模式 · 完整战斗特效");
        return;
      }
      const script = document.createElement("script");
      script.src = sources[index++];
      script.async = true;
      script.crossOrigin = "anonymous";
      let done = false;
      const finish = () => {
        if (done || active) return;
        done = true;
        clearTimeout(timer);
        if (window.THREE) init(window.THREE);
        else next();
      };
      const timer = setTimeout(finish, 5500);
      script.onload = finish;
      script.onerror = finish;
      document.head.appendChild(script);
    }
    next();
  }
  return {
    load,
    init,
    sync,
    burst,
    setView,
    setTheme,
    quality,
    get active() {
      return active;
    },
  };
})();
