/* 战场视角实验台 — whole boards of the battlefield's own figures (EmberVoxelArena, the same code and director beats
 * the battle plays) under candidate cameras, layouts and board shapes, inside the screen the game has to share with
 * its chrome (top bar, hand, end-turn button, the stats under each unit): to choose how the battlefield is seen.
 *
 * A scheme is a board shape, where the two sides and their heroes stand, and a camera (lens, pitch, yaw); the
 * camera's distance and aim are fitted so every unit and hero lands inside the space the chrome leaves. Sizes are in
 * figure heights (a person ≈ 1). The board, hand and plates are stand-ins; the figures, their moves and effects are
 * the game's. Driven by tools/move-review (serve.py /lab); `window.Lab` is what a capture script calls. */
(() => {
  const THREE = EmberVesperThree, A = EmberVoxelArena, C = EmberVoxelClips, MS = EmberMoveSheet;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const $ = (s) => document.querySelector(s);
  const Q = new URLSearchParams(location.search);
  const TIMING = { stop: [0, 0, 50, 90], lift: MS.DIRECTOR.lift, lunge: MS.DIRECTOR.lunge, recover: 200, recoil: MS.DIRECTOR.recoil, speed: 1800, flightMin: 90, flightMax: 220 };
  const STEP = 1000 / 60, HT = 1, DAIS = 0.1;
  const ease = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const rad = (d) => (d * Math.PI) / 180;

  // ------------------------------------------------------------------ the clock (the arena stamps everything with it)
  const real = performance.now.bind(performance);
  let vt = real();
  performance.now = () => vt;
  const jobs = [];
  const later = (ms, fn) => jobs.push({ at: vt + ms, fn });
  const runJobs = () => { for (let i = 0; i < jobs.length; ) { if (jobs[i].at <= vt + 0.01) jobs.splice(i, 1)[0].fn(); else i++; } };
  let paused = false;

  // ------------------------------------------------------------------ who stands on the board
  const has = (id) => typeof EmberModelArt !== "undefined" && !!EmberModelArt[id] && !!EmberVoxelKit.get(id);
  const pick = (list) => list.filter(has);
  const MINE = pick(["paladin", "huntress", "spark", "berserker", "cleric", "assassin", "golem", "solaris", "guard"]).slice(0, 7);
  const THEIRS = pick(["reaper", "wolf", "squire", "skeleton", "frostking", "nyx", "treant", "leech", "recruit"]).slice(0, 7);
  const HEROES = { p: has("rowan") ? "rowan" : MINE[0], e: has("whistle") ? "whistle" : THEIRS[0] };
  const NAMES = { p: "守林人", e: "铁哨" };
  const STATS = [[4, 5], [5, 4], [1, 3], [3, 4], [2, 6], [6, 2], [7, 7]];

  // ------------------------------------------------------------------ the schemes
  const row = (n, z, sp, x0 = 0) => Array.from({ length: n }, (_, i) => V3(x0 + (i - (n - 1) / 2) * sp, 0, z));
  // a side's line: one row; on a phone held upright, two (the front four, the other three behind them, between)
  const line = (n, z, sp, port) => {
    if (!port || n <= 4) return row(n, z, sp);
    const f = Math.ceil(n / 2), out = Math.sign(z) || 1;
    return [...row(f, z, Math.max(sp, 0.95)), ...row(n - f, z + out * 0.9, Math.max(sp, 0.95))];
  };
  const turn = (L, deg) => {
    const a = rad(deg), c = Math.cos(a), s = Math.sin(a), r = (v) => V3(v.x * c + v.z * s, v.y, -v.x * s + v.z * c);
    return { ...L, p: L.p.map(r), e: L.e.map(r), ph: r(L.ph), eh: r(L.eh), board: { ...L.board, rot: (L.board.rot || 0) + deg } };
  };
  // two staggered columns a side, the sides left and right (a side-on battle: each depth row a pair, every other
  // row stepped out so the one behind shows)
  // (T: the formation's numbers — x0 the front column's distance from the middle, gap between the columns, stag the
  // step out of every other depth row, dz between depth rows)
  const cols = (n, sgn, T = {}) => {
    const m = Math.ceil(n / 2), { x0 = 1.0, gap = 0.95, stag = 0.32, dz = 1.0 } = T;
    return Array.from({ length: n }, (_, i) => { const j = Math.floor(i / 2), col = i % 2; return V3(sgn * (x0 + col * gap + (j % 2) * stag), 0, ((m - 1) / 2 - j) * dz); });
  };
  // a side on an arc round the middle of a round board, facing in
  const arc = (n, sgn, R = 2.15, step = 19) => Array.from({ length: n }, (_, i) => { const t = rad(sgn * 90 + (i - (n - 1) / 2) * step * sgn); return V3(R * Math.cos(t), 0, R * Math.sin(t)); });
  const front = (n, port) => { const b = port && n > 4 ? 0.9 : 0; return { p: line(n, 1.25, 0.95, port), e: line(n, -1.3, 0.95, port), ph: V3(0, DAIS, 2.95 + b), eh: V3(0, DAIS, -3.05 - b), board: { shape: "rect", w: port ? 4.8 : 7.8, d: 4.6 + 2 * b } }; };
  const sideOn = (n, port, T = {}) => { const hx = (T.x0 ?? 1.0) + (T.gap ?? 0.95) + (T.stag ?? 0.32) + 1.2, d = Math.ceil(n / 2) * (T.dz ?? 1.0) + 0.6;
    return { p: cols(n, -1, T), e: cols(n, 1, T), ph: V3(-hx, DAIS, 0), eh: V3(hx, DAIS, 0), board: { shape: "rect", w: 2 * hx + 1.6, d: Math.max(4.6, d) } }; };
  const SCHEMES = [
    { id: "now", name: "① 现状：正面远景", cam: { fov: 18, pitch: 30, yaw: 0 },
      layout: (n, port) => port ? { p: line(n, 1.5, 0.9, true), e: line(n, -1.5, 0.9, true), ph: V3(-1.6, DAIS, 3.6), eh: V3(1.6, DAIS, -3.6), board: { shape: "rect", w: 4.6, d: 6.6 } }
        : { p: row(n, 1.5, 0.72), e: row(n, -1.5, 0.72), ph: V3(-4.1, DAIS, 2.6), eh: V3(4.3, DAIS, -2.4), board: { shape: "rect", w: 6.4, d: 5.2 } },
      about: "现在的做法：长焦从正前上方 30° 俯视，两排随从前后对阵，英雄在左下、右上角的高台上。<b>优点</b>：满场一眼看全，铭牌不被挡。<b>缺点</b>：角色小；我方背对镜头；英雄离战场远。" },
    { id: "front", name: "② 正面·英雄居中（炉石式）", cam: { fov: 32, pitch: 40, yaw: 0 }, layout: front,
      about: "炉石式：英雄站在各自一排的正后方中间，两排靠近，镜头更广角（32°）。<b>优点</b>：英雄就在战场里，攻击英雄时冲刺短、方向清楚。<b>缺点</b>：英雄占了上下的空间，角色反而比现状小约三成；我方仍背对镜头。" },
    { id: "tactics", name: "③ 高俯视战棋", cam: { fov: 24, pitch: 62, yaw: 0 },
      layout: (n, port) => { const b = port && n > 4 ? 0.9 : 0; return { p: line(n, 1.3, 0.9, port), e: line(n, -1.3, 0.9, port), ph: V3(0, DAIS, 2.9 + b), eh: V3(0, DAIS, -2.9 - b), board: { shape: "rect", w: port ? 4.6 : 7.6, d: 4.6 + 2 * b } }; },
      about: "接近正上方往下看（62°）。<b>优点</b>：谁站在哪儿最清楚，永不遮挡，铭牌最好读，手机竖屏也放得下。<b>缺点</b>：看到的多是头顶和肩膀，动作和表情最弱，招式的高度感（跃起、天降）几乎看不出。" },
    { id: "diagonal", name: "④ 斜角对阵", cam: { fov: 28, pitch: 40, yaw: 0 }, layout: (n, port) => turn(front(n, port), 32),
      about: "自走棋/万象棋式：棋盘斜放，两排沿对角线相对，敌方在左上、我方在右下。<b>优点</b>：双方都是四分之三侧面，我方不再完全背对；冲刺斜穿画面，最有纵深感。<b>缺点</b>：两排在屏幕上的宽度变窄，满场时左右两端会挤；方向感需要适应。" },
    { id: "side", name: "⑤ 侧视横版", cam: { fov: 26, pitch: 30, yaw: 0 }, layout: sideOn,
      about: "JRPG/最暗地牢式：我方在左、敌方在右，各自排成前后两列，英雄站在本方最后。<b>优点</b>：双方都是侧脸，冲刺和施法横穿画面，招式看得最完整；最像“对战”。<b>缺点</b>：7 个人要排成纵深，后排会被前排挡一部分；竖屏手机放不下（只能横屏玩）。" },
    // (its numbers from a search over 288 cameras and formations, 2026-10-03: no two silhouettes overlapping on a full
    // board, the largest figures that allows — the depth rows a little further apart, every other one stepped out more)
    { id: "shoulder", name: "⑥ 我方背后斜侧", cam: { fov: 30, pitch: 22, yaw: -46 }, tune: { dz: 1.2, gap: 0.95, stag: 0.55, x0: 1.0 }, layout: sideOn,
      about: "宝可梦/最终幻想式：镜头站在我方左后方，我方在近处、敌方在远处正对着我们。<b>优点</b>：代入感最强，敌人的正脸和招式最清楚，我方能看到侧后背影与武器。<b>缺点</b>：我方离镜头近、显得比敌人大；竖屏放不下（竖屏改用别的方案）。" },
    { id: "arena", name: "⑦ 弧形竞技场", cam: { fov: 28, pitch: 40, yaw: 0 },
      layout: (n) => ({ p: arc(n, 1), e: arc(n, -1), ph: V3(0, DAIS, 3.35), eh: V3(0, DAIS, -3.35), board: { shape: "circle", r: 3.9 } }),
      about: "圆形战场，两方各排成一道弧面向中心，英雄在弧的后方中间。<b>优点</b>：两端的随从转向中间，我方两侧能看到侧脸；画面有向心的舞台感。<b>缺点</b>：位置顺序变成弧形，第几个位置不如直线直观；圆形战场在宽屏上留白较多。" },
    { id: "close", name: "⑧ 正面低机位（审片台式）", cam: { fov: 24, pitch: 22, yaw: 0 },
      layout: (n, port) => { const b = port && n > 4 ? 0.9 : 0; return { p: line(n, 0.95, 1.0, port), e: line(n, -0.95, 1.0, port), ph: V3(0, DAIS, 2.4 + b), eh: V3(0, DAIS, -2.5 - b), board: { shape: "rect", w: port ? 4.8 : 8.2, d: 4.0 + 2 * b } }; },
      about: "把审片台“对局”视角直接用于满场：镜头低（22°）、两排很近。<b>优点</b>：角色最大、最有电影感。<b>缺点</b>：前排挡后排、敌方脚下与铭牌被我方遮住，满场时难以分辨谁是谁。" },
  ];
  const SCREENS = {
    desk: { name: "桌面 1600×940", w: 1600, h: 940, safe: { top: 74, bottom: 786, left: 40, right: 1560 } },
    land: { name: "手机横屏", w: 844, h: 390, safe: { top: 58, bottom: 288, left: 20, right: 824 } },
    port: { name: "手机竖屏", w: 390, h: 844, safe: { top: 60, bottom: 712, left: 8, right: 382 } },
  };
  let SCR = SCREENS[Q.get("screen")] || SCREENS.desk, N = Number(Q.get("n")) || 7;
  // the user's choice (2026-10-03): ⑥ whenever the screen lies on its side (a desktop, a phone held sideways), ② on a
  // phone held upright — "auto" follows the screen
  const AUTO = { land: "shoulder", desk: "shoulder", port: "front" };
  let auto = !Q.get("scheme") || Q.get("scheme") === "auto";
  const autoScheme = () => SCHEMES.find((s) => s.id === AUTO[Object.keys(SCREENS).find((k) => SCREENS[k] === SCR)]);
  let SC = auto ? autoScheme() : SCHEMES.find((s) => s.id === Q.get("scheme")) || SCHEMES[0];
  let L = SC.layout(N, SCR === SCREENS.port, SC.tune);
  const posOf = (ref) => (ref.uid === "hero" ? (ref.side === "p" ? L.ph : L.eh) : L[ref.side][Number(ref.uid)]) || null;

  // ------------------------------------------------------------------ renderers, room, board
  const frameEl = $("#frame"), canvas = $("#stage"), roomCanvas = $("#room");
  const roomRenderer = new THREE.WebGLRenderer({ canvas: roomCanvas, antialias: true, preserveDrawingBuffer: true });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
  for (const r of [roomRenderer, renderer]) { r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping; }
  renderer.setClearColor(0, 0);
  const pass = EmberPixelPass.create(renderer, { up: true });
  const dpr = () => Math.min(devicePixelRatio || 1, 2);
  const room = new THREE.Scene();
  let scene = new THREE.Scene();
  const quad = (fs, extra = {}) => new THREE.ShaderMaterial({ vertexShader: "varying vec3 p; varying vec2 u; void main(){ p = position; u = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }", fragmentShader: fs, depthWrite: false, ...extra });
  const NOISE = "float h(vec2 p){ return fract(sin(dot(p, vec2(12.99, 78.23))) * 43758.5); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }";
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), quad("varying vec3 p; void main(){ vec3 d = normalize(p); float y = d.y; vec3 lo = vec3(0.06,0.05,0.05), hz = vec3(0.17,0.11,0.08), hi = vec3(0.035,0.04,0.06); vec3 c = mix(lo, hz, smoothstep(-0.1, 0.0, y)); c = mix(c, hi, smoothstep(0.0, 0.32, y)); gl_FragColor = vec4(c, 1.); }", { side: THREE.BackSide }));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 120), quad(`varying vec2 u; ${NOISE} void main(){ float d = length(u); float s = n(u * 1.6) * 0.55 + n(u * 6.0) * 0.3 + n(u * 21.0) * 0.15; vec3 c = mix(vec3(0.07,0.06,0.055), vec3(0.15,0.12,0.1), s); c *= 1.15 - 0.9 * smoothstep(3.0, 14.0, d); gl_FragColor = vec4(c, 1.); }`));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02;
    room.add(sky, floor);
  }
  // the board: wooden planks inside its shape (rect: half sizes; circle: radius), an iron rim, a centre line
  const BOARD_FS = `uniform vec2 uHalf; uniform float uShape; varying vec2 u; ${NOISE}
    void main(){
      vec2 q = u; float edge = uShape < 0.5 ? min(uHalf.x - abs(q.x), uHalf.y - abs(q.y)) : uHalf.x - length(q);
      if (edge < 0.0) discard;
      float pw = 0.34, r = floor(q.y / pw), off = h(vec2(r, 3.1)) * 3.0, fy = fract(q.y / pw), fx = fract((q.x + off) / 1.9), seg = floor((q.x + off) / 1.9);
      float seam = max(1.0 - smoothstep(0.0, 0.035, min(fy, 1.0 - fy)), 1.0 - smoothstep(0.0, 0.01, min(fx, 1.0 - fx)));
      float tone = h(vec2(r, seg)), grain = n(vec2(q.x * 2.0, q.y * 30.0));
      vec3 c = mix(vec3(0.36, 0.2, 0.1), vec3(0.52, 0.31, 0.15), tone) * (0.82 + 0.3 * grain);
      c *= 1.0 - 0.55 * seam;
      float rim = 1.0 - smoothstep(0.1, 0.13, edge); c = mix(c, vec3(0.11, 0.09, 0.08), rim);
      c *= 0.75 + 0.25 * smoothstep(0.0, 0.6, edge);
      gl_FragColor = vec4(c, 1.); }`;
  let boardGroup = null;
  function buildBoard() {
    if (boardGroup) { room.remove(boardGroup); boardGroup.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); }); }
    const g = new THREE.Group(), B = L.board;
    const geo = B.shape === "circle" ? new THREE.CircleGeometry(B.r, 96) : new THREE.PlaneGeometry(B.w, B.d);
    const m = new THREE.Mesh(geo, quad(BOARD_FS, { uniforms: { uHalf: { value: new THREE.Vector2(B.shape === "circle" ? B.r : B.w / 2, B.shape === "circle" ? B.r : B.d / 2) }, uShape: { value: B.shape === "circle" ? 1 : 0 } } }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rad(B.rot || 0); g.add(m);
    // the heroes' daises: a dark drum, a lit ring
    for (const [hp, col] of [[L.ph, 0x5aa0ff], [L.eh, 0xff7a4a]]) {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, DAIS, 48), new THREE.MeshBasicMaterial({ color: 0x1c1714 }));
      drum.position.set(hp.x, DAIS / 2, hp.z);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.56, 64), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.set(hp.x, DAIS + 0.003, hp.z);
      g.add(drum, ring);
    }
    room.add(g); boardGroup = g;
  }
  const shadowMat = quad("varying vec2 u; void main(){ float d = length(u); gl_FragColor = vec4(0.,0.,0., 0.45 * (1. - smoothstep(0.1, 1., d))); }", { transparent: true });
  const shadows = new Map();

  // ------------------------------------------------------------------ the arena
  const human = [];
  const scaleOf = (u) => {
    const g = u.fig?.mesh?.geometry; if (!g) return 1;
    if (!g.boundingBox) g.computeBoundingBox();
    const nat = Math.max(0.2, g.boundingBox.max.y * (u.spec.scale || 1));
    // a person is a figure height tall (a hero a little taller); a beast keeps its size against a person's, no taller
    // than one and a tenth
    if (!u.fig.beast) { if (!u.info.hero && human.length < 12 && !human.includes(nat)) human.push(nat); return (HT * (u.info.hero ? 1.12 : 1)) / nat; }
    const med = human.length ? [...human].sort((a, b) => a - b)[human.length >> 1] : 1;
    return Math.min(HT / med, (1.1 * HT) / nat);
  };
  function makeArena() {
    scene.traverse((o) => { o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) m.dispose?.(); });
    scene = new THREE.Scene();
    return A.create(scene, {
      size: 1, pixelRatio: dpr, fxLayer: 2, shots: true,
      where: (ref) => posOf(ref)?.clone() || null,
      base: (u) => ({ r: (u.info.hero ? 0.5 : 0.34) * HT, state: {}, ring: !!u.info.hero, tint: u.side === "p" ? [0.4, 0.62, 1.4] : [1.4, 0.55, 0.3] }),
      scaleOf,
    });
  }
  let arena = makeArena();
  const unit = (r) => arena.unit(r.side, String(r.uid));
  function populate() {
    for (const side of ["p", "e"]) {
      arena.set(side, "hero", HEROES[side], { hero: true });
      (side === "p" ? MINE : THEIRS).slice(0, N).forEach((id, i) => arena.set(side, String(i), id, {}));
    }
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function tick(dt) { vt += dt; runJobs(); place(); arena.step(vt, cam, dt / 1000); }
  function ff(ms) { for (let t = 0; t < ms - 1e-6; t += STEP) tick(Math.min(STEP, ms - t)); }
  let readyP = null;
  function ready() {
    return (readyP ||= (async () => {
      const all = () => { let n = 0, live = 0; arena.each((u) => { n++; if (u.state === "live") live++; }); return n > 0 && live === n; };
      for (let i = 0; i < 400 && !all(); i++) { await sleep(40); ff(120); }
      ff(300);
      return all();
    })());
  }
  function rebuild() { for (const s of shadows.values()) room.remove(s); shadows.clear(); arena.dispose(); arena = makeArena(); readyP = null; populate(); }

  // ------------------------------------------------------------------ the camera: fitted into the room the chrome leaves
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 300);
  const fit = { T: V3(), D: 10 };
  const orbit = { yaw: 0, pitch: 0, zoom: 1 };
  const camOf = () => ({ fov: SC.cam.fov, pitch: Math.max(4, Math.min(85, SC.cam.pitch + orbit.pitch)), yaw: SC.cam.yaw + orbit.yaw });
  function aim(T, D, c) {
    const y = rad(c.yaw), p = rad(c.pitch);
    cam.position.set(T.x + D * Math.sin(y) * Math.cos(p), T.y + D * Math.sin(p), T.z + D * Math.cos(y) * Math.cos(p));
    cam.lookAt(T); cam.updateMatrixWorld();
  }
  function keyPoints() {
    const out = [];
    // (each foot, each head, and the stats plate under each: a point a little under the ground shows lower on screen)
    for (const p of [...L.p, ...L.e]) out.push(p.clone(), p.clone().setY(1.05 * HT), p.clone().setY(-0.22));
    for (const p of [L.ph, L.eh]) out.push(p.clone(), p.clone().setY(p.y + 1.2 * HT), p.clone().setY(-0.4));
    return out;
  }
  function refit() {
    const c = camOf(), W = SCR.w, H = SCR.h, S = SCR.safe;
    cam.fov = c.fov; cam.aspect = W / H; cam.updateProjectionMatrix();
    const pts = keyPoints(), sx0 = (S.left / W) * 2 - 1, sx1 = (S.right / W) * 2 - 1, sy0 = 1 - (S.bottom / H) * 2, sy1 = 1 - (S.top / H) * 2;
    const T = pts.reduce((a, p) => a.add(V3(p.x, 0, p.z)), V3()).multiplyScalar(1 / pts.length);
    let D = 12;
    const q = V3();
    for (let it = 0; it < 60; it++) {
      aim(T, D, c);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of pts) { q.copy(p).project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      const s = Math.max((x1 - x0) / (sx1 - sx0), (y1 - y0) / (sy1 - sy0));
      D *= Math.pow(s, 0.6);
      const k = D * Math.tan(rad(c.fov) / 2), right = V3(1, 0, 0).applyQuaternion(cam.quaternion).setY(0).normalize(), fwd = V3(0, 0, -1).applyQuaternion(cam.quaternion).setY(0).normalize();
      T.addScaledVector(right, (((x0 + x1) / 2 - (sx0 + sx1) / 2) * k * cam.aspect) / 2);
      T.addScaledVector(fwd, (((y0 + y1) / 2 - (sy0 + sy1) / 2) * k) / 2 / Math.max(0.35, Math.sin(rad(c.pitch))));
    }
    fit.T.copy(T); fit.D = D;
  }
  // the punch: the camera moves in on an attack (between its attacker and its target) and back out after the blow
  const punch = { on: Q.get("punch") === "1", a: null, b: null, t0: 0, hit: 0 };
  function place() {
    const c = camOf();
    let T = fit.T, D = fit.D * orbit.zoom;
    if (punch.on && punch.a) {
      const w = ease((vt - punch.t0) / 260) * (1 - ease((vt - punch.hit - 380) / 420));
      if (w > 0) { T = fit.T.clone().lerp(punch.a.clone().lerp(punch.b, 0.5).setY(0), 0.85 * w); D *= 1 - 0.5 * w; }
    }
    aim(T, D, c);
    const sh = arena.shake(vt);
    if (sh > 1e-4) { cam.position.x += sh * Math.sin(vt * 0.093); cam.position.y += sh * 0.8 * Math.cos(vt * 0.121); cam.updateMatrixWorld(); }
  }

  // ------------------------------------------------------------------ the demos (attacks on the director's beats)
  function attack(from, to, tier) {
    const u = unit(from); if (!u || u.state !== "live") return null;
    const m = u.spec.moves?.attack || {}, ranged = !!m.ranged, stop = TIMING.stop[tier];
    let lift, contact;
    if (ranged) { lift = TIMING.recoil + (u.fig?.spell?.windup ?? u.fig?.sig?.draw ?? m.windup ?? 260); contact = lift + Math.max(TIMING.flightMin, Math.min(TIMING.flightMax, ((posOf(from).distanceTo(posOf(to)) * 200) / TIMING.speed) * 1000)); }
    else { lift = TIMING.lift + (u.fig?.sig?.windup ?? 0); contact = lift + TIMING.lunge; }
    const release = contact + stop, duration = release + (ranged ? 0 : TIMING.recover);
    arena.cue(from.side, String(from.uid), "attack", { toward: { side: to.side, uid: String(to.uid) }, planned: true, ranged, tier, liftMs: lift, contactMs: contact, releaseMs: release, durationMs: duration });
    later(contact, () => arena.contact({ side: to.side, uid: String(to.uid) }, { tier, from: { side: from.side, uid: String(from.uid) }, direction: "outgoing" }));
    punch.a = posOf(from).clone(); punch.b = posOf(to).clone(); punch.t0 = vt; punch.hit = vt + contact;
    return { contact, release };
  }
  const idx = (list, id, fb) => { const i = list.slice(0, N).indexOf(id); return i >= 0 ? i : Math.min(fb, N - 1); };
  const ACTS = {
    melee: { label: "近战", run: () => attack({ side: "p", uid: idx(MINE, "berserker", 3) }, { side: "e", uid: idx(THEIRS, "wolf", 1) }, 2) },
    heavy: { label: "招牌重击", run: () => attack({ side: "p", uid: idx(MINE, "paladin", 0) }, { side: "e", uid: idx(THEIRS, "squire", 2) }, 3) },
    ranged: { label: "远程", run: () => attack({ side: "p", uid: idx(MINE, "spark", 2) }, { side: "e", uid: idx(THEIRS, "skeleton", 3) }, 2) },
    foe: { label: "敌方进攻", run: () => attack({ side: "e", uid: idx(THEIRS, "reaper", 0) }, { side: "p", uid: idx(MINE, "huntress", 1) }, 2) },
    hero: { label: "打英雄", run: () => attack({ side: "p", uid: idx(MINE, "berserker", 3) }, { side: "e", uid: "hero" }, 2) },
  };

  // ------------------------------------------------------------------ the screen, the plates
  const plates = new Map();
  function plateOf(u) {
    let el = plates.get(u.k);
    if (!el) {
      el = document.createElement("div"); el.className = `plate ${u.side}${u.info.hero ? " hero" : ""}`;
      const s = u.info.hero ? null : STATS[Number(u.uid) % STATS.length];
      el.innerHTML = u.info.hero ? `<b>${NAMES[u.side]}</b><em>♥ 30</em>` : `<b>⚔ ${s[0]}</b><em>♥ ${s[1]}</em>`;
      $("#plates").appendChild(el); plates.set(u.k, el);
    }
    return el;
  }
  function layoutFrame() {
    const bay = $("#bay"), bw = bay.clientWidth - 24, bh = bay.clientHeight - 24, k = Math.min(bw / SCR.w, bh / SCR.h, SCR.w < 900 ? 1.35 : 1);
    frameEl.style.width = Math.round(SCR.w * k) + "px"; frameEl.style.height = Math.round(SCR.h * k) + "px";
    frameEl.style.setProperty("--u", (Math.round(SCR.h * k) / SCR.h).toFixed(4) + "px");
    document.body.classList.toggle("port", SCR === SCREENS.port); document.body.classList.toggle("land", SCR === SCREENS.land);
  }
  function draw() {
    const w = frameEl.clientWidth, h = frameEl.clientHeight;
    if (w && h && (canvas.width !== Math.round(w * dpr()) || canvas.height !== Math.round(h * dpr()))) {
      for (const r of [roomRenderer, renderer]) { r.setPixelRatio(dpr()); r.setSize(w, h, false); }
      arena.setPixelRatio?.(dpr());
    }
    place();
    const q = V3();
    arena.each((u) => {
      let s = shadows.get(u.k);
      if (!s) { s = new THREE.Mesh(new THREE.CircleGeometry(1, 32), shadowMat); s.rotation.x = -Math.PI / 2; room.add(s); shadows.set(u.k, s); }
      const p = u.fig?.root.position || posOf(u); if (!p) return;
      s.position.set(p.x, (u.info.hero ? DAIS : 0) + 0.004, p.z); s.scale.setScalar(0.4 * HT);
      // its stats under its feet (at its station: they stay home while it dashes, as the game's do)
      const home = posOf(u); q.copy(home).project(cam);
      const el = plateOf(u);
      el.style.left = ((q.x + 1) / 2) * w + "px"; el.style.top = ((1 - q.y) / 2) * h + (u.info.hero ? 10 : 4) * (h / SCR.h) + "px";
    });
    roomRenderer.render(room, cam);
    pass.render(scene, cam, [EmberSpriteFigures.LAYER, 2]);
  }
  let last = real();
  function frame() {
    requestAnimationFrame(frame);
    const r = real(), dt = Math.min(50, r - last); last = r;
    if (!paused) tick(dt);
    draw();
  }

  // ------------------------------------------------------------------ the panel
  const chips = (host, items, cur, fn, list = false) => {
    host.innerHTML = "";
    for (const it of items) {
      const b = document.createElement("button"); b.className = "chip"; b.type = "button";
      b.innerHTML = it.label + (it.sub ? `<small>${it.sub}</small>` : "");
      b.setAttribute("aria-pressed", String(it.key === cur));
      b.onclick = () => fn(it.key);
      host.appendChild(b);
    }
  };
  function panel() {
    chips($("#schemes"), [{ key: "auto", label: "按屏幕自动：横屏 ⑥ · 竖屏 ②", sub: "你选的组合" }, ...SCHEMES.map((s) => ({ key: s.id, label: s.name }))], auto ? "auto" : SC.id, (k) => { auto = k === "auto"; setScheme(auto ? autoScheme().id : k); }, true);
    $("#about").innerHTML = SC.about;
    chips($("#screens"), Object.entries(SCREENS).map(([k, s]) => ({ key: k, label: s.name })), Object.keys(SCREENS).find((k) => SCREENS[k] === SCR), (k) => setScreen(k));
    chips($("#counts"), [{ key: 4, label: "4 对 4" }, { key: 7, label: "7 对 7（满场）" }], N, (k) => setCount(k));
    chips($("#acts"), Object.entries(ACTS).map(([k, a]) => ({ key: k, label: a.label })), null, (k) => run(k));
    chips($("#cams"), [{ key: "punch", label: punch.on ? "出招推近：开" : "出招推近：关" }, { key: "reset", label: "复位" }], punch.on ? "punch" : null, (k) => {
      if (k === "punch") punch.on = !punch.on; else { orbit.yaw = 0; orbit.pitch = 0; orbit.zoom = 1; }
      panel();
    });
    $("#cap").textContent = SC.name;
    const m = window.Lab?.measure?.();
    if (m) $("#about").innerHTML += `<div class="hint">这块屏幕上：我方一人约 <b>${m.near}</b> 像素高，敌方约 <b>${m.far}</b> 像素；轮廓互相重叠的有 <b>${m.overlaps}</b> 对。</div>`;
  }
  function setScheme(id) { SC = SCHEMES.find((s) => s.id === id) || SC; L = SC.layout(N, SCR === SCREENS.port, SC.tune); orbit.yaw = 0; orbit.pitch = 0; orbit.zoom = 1; buildBoard(); refit(); panel(); }
  function setScreen(k) { SCR = SCREENS[k] || SCR; if (auto) SC = autoScheme(); L = SC.layout(N, SCR === SCREENS.port, SC.tune); buildBoard(); layoutFrame(); refit(); panel(); }
  function setCount(n) { N = n; L = SC.layout(N, SCR === SCREENS.port, SC.tune); for (const el of plates.values()) el.remove(); plates.clear(); rebuild(); buildBoard(); refit(); panel(); }
  async function run(k) { await ready(); paused = false; return ACTS[k].run(); }
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: orbit.yaw, pitch: orbit.pitch }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; orbit.yaw = drag.yaw - (e.clientX - drag.x) * 0.3; orbit.pitch = drag.pitch + (e.clientY - drag.y) * 0.2; });
  canvas.addEventListener("pointerup", () => { drag = null; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); orbit.zoom = Math.max(0.4, Math.min(2.5, orbit.zoom * Math.exp(e.deltaY * 0.001))); }, { passive: false });
  addEventListener("resize", () => { layoutFrame(); });

  // ------------------------------------------------------------------ start
  layoutFrame(); buildBoard(); refit(); populate(); panel(); frame();
  ready();

  /* what a capture script drives: a scheme on a screen, and an act held at a moment */
  window.Lab = {
    SCHEMES, SCREENS, ACTS, ready, ff, draw,
    set: async ({ scheme, screen, n, punch: pu } = {}) => {
      if (n && n !== N) setCount(n);
      if (scheme) auto = scheme === "auto";
      if (screen) setScreen(screen);
      if (scheme) setScheme(auto ? autoScheme().id : scheme);
      if (pu != null) { punch.on = !!pu; panel(); }
      await ready(); return true;
    },
    /** the act played to `ms` after its cue and held there (the world before it run on until everything is quiet) */
    hold: async (act, ms, fromHit = false) => { await ready(); paused = true; ff(2600); punch.a = null; const r = ACTS[act].run(); ff(Math.max(0, ms + (fromHit && r ? r.contact : 0))); draw(); return r; },
    rest: async () => { await ready(); paused = true; ff(2600); punch.a = null; draw(); },
    resume: () => { paused = false; },
    get scheme() { return SC.id; }, get fit() { return { T: fit.T.toArray(), D: fit.D }; },
    /** how large a person stands on screen (design px: feet to head) on each side, and how many neighbours'
     *  silhouettes overlap (each unit a box half a figure wide, a figure tall, as the camera sees it) */
    /** try other numbers on the current scheme: its camera ({ fov, pitch, yaw }) and its formation (tune) → measure */
    tryout: ({ cam: c, tune } = {}) => { if (c) SC.cam = { ...SC.cam, ...c }; if (tune) SC.tune = { ...(SC.tune || {}), ...tune }; L = SC.layout(N, SCR === SCREENS.port, SC.tune); buildBoard(); refit(); panel(); return window.Lab.measure(); },
    measure: () => {
      place();
      const box = (p) => { const f = p.clone().project(cam), h = p.clone().setY(HT).project(cam), w = p.clone().add(V3(0.22 * HT, 0, 0)).project(cam);
        const X = (v) => ((v.x + 1) / 2) * SCR.w, Y = (v) => ((1 - v.y) / 2) * SCR.h, hw = Math.max(Math.abs(X(w) - X(f)), 4);
        return { x0: X(f) - hw, x1: X(f) + hw, y0: Y(h), y1: Y(f), h: Y(f) - Y(h) }; };
      const B = { p: L.p.map(box), e: L.e.map(box) }, all = [...B.p, ...B.e];
      let over = 0, pairs = 0;
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { pairs++; const a = all[i], b = all[j], ix = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), iy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (ix > 0 && iy > 0 && ix * iy > 0.15 * Math.min((a.x1 - a.x0) * a.h, (b.x1 - b.x0) * b.h)) over++; }
      const avg = (a) => Math.round(a.reduce((s, b) => s + b.h, 0) / a.length);
      return { near: avg(B.p), far: avg(B.e), overlaps: over };
    },
  };
})();
