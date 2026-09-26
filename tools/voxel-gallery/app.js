/* 像素角色馆 — every battlefield figure (Q-version pixel sprites) in one room, driven by the battlefield's own behaviour
 * (EmberVoxelArena: bake → assemble, idle, the melee dash on the director's timeline, the contact burst, victim glow
 * and hitstop, the shatter death beat). Three views: 全员 (all figures, click one), 单人 (one figure, orbit, every
 * action), 对战 (two figures, normal / heavy / lethal hits with sound). The timings below mirror
 * src/presentation/timing.js so a hit here lands the way it lands in a battle. */
(() => {
  const THREE = EmberVesperThree, R = EmberVoxelRender, KIT = EmberVoxelKit, A = EmberVoxelArena, SFX = EmberGallerySfx;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const $ = (s) => document.querySelector(s);
  // director numbers (timing.js): hit-stop per tier, the melee lunge, the ranged recoil and flight speed
  const TIMING = { stop: [0, 0, 50, 90], lift: 110, lunge: 150, recover: 200, recoil: 90, speed: 1800, flightMin: 90, flightMax: 220, deathDelay: 120 };
  const STYLE = { slash: "劈砍", thrust: "突刺", blunt: "重击", bite: "撕咬", breath: "吐息", bolt: "法术弹", arrow: "射箭" };
  // who is who (card names from src/content/cards.js); groups are how the roster is shelved
  const INFO = {
    huntress: { name: "荒野之矛", card: "huntress", note: "兜帽精灵，叶刃长矛" },
    guard: { name: "铁誓卫士", card: "guard", note: "全身板甲，鸢盾长矛" },
    skeleton: { name: "骸骨", card: "skeleton", note: "空洞眼窝里的余烬" },
    vesper: { name: "薇丝珀", card: "hero:ranger · archer", note: "暗影游侠，英雄本人" },
    spark: { name: "引火学徒", card: "spark", note: "掌心托着一颗火星" },
    sentinel: { name: "烬翼斥候", card: "sentinel", note: "机械刃翼俯冲" },
    wolf: { name: "月影幼狼", card: "wolf", note: "冰蓝眼的灰狼崽" },
    duskstag: { name: "暮角契鹿", card: "duskstag", note: "新月鹿角，月纹发光" },
    spider: { name: "幽谷蛛后", card: "spider", note: "八足，翡翠晶腹" },
    golem: { name: "符文石像", card: "golem", note: "巨拳，胸口一枚符文" },
    treant: { name: "古木守护者", card: "treant", note: "树皮身躯，枝臂" },
    dragon: { name: "烬喉幼龙", card: "dragon", note: "琥珀翼膜，火焰吐息" },
    assassin: { name: "夜幕刺客", card: "assassin", note: "兜帽黑衣，银色匕首" },
    reaper: { name: "黯月收割者", card: "reaper", note: "虚空之脸，红刃巨镰" },
    leech: { name: "血月行者", card: "leech", note: "掌心托着血月之球" },
    necromancer: { name: "亡者织梦师", card: "necromancer", note: "高举青色鬼灯" },
    soulguide: { name: "渡魂引路人", card: "soulguide", note: "银发，提一盏魂灯" },
    oracle: { name: "星界观测者", card: "oracle", note: "转动的星盘" },
    moonfox: { name: "银灯灵狐", card: "moonfox", note: "新月大尾，尾尖一盏灯" },
    eclipsewolf: { name: "蚀月狼王", card: "eclipsewolf", note: "背负一轮日蚀" },
    rider: { name: "霜牙狼骑", card: "rider", note: "冰晶狼与骑士" },
    pup: { name: "幽灵狼", card: "pup", note: "大头大爪的狼崽" },
    spiritwolf: { name: "灵狼", card: "spiritwolf", note: "翠绿发光，焰尾" },
    moonguard: { name: "守灯巨兽", card: "moonguard", note: "新月塔盾的银甲巨人" },
    selmyra: { name: "冥月神·瑟弥拉", card: "selmyra", note: "脑后一轮日蚀" },
    fenlos: { name: "荒猎神·芬洛斯", card: "fenlos", note: "狼首鹿角，绿叶披风" },
    wisp: { name: "暮光精灵", card: "wisp", note: "翠绿蜻蜓翅，掌心法球" },
    phoenix: { name: "不灭凤凰", card: "phoenix", note: "蓝白羽翼，胸口金焰" },
    nyx: { name: "星陨女王·妮克丝", card: "nyx", note: "冰晶冠冕，星辰权杖" },
    frostking: { name: "白霜之王", card: "frostking", note: "冰晶巨剑，白裘披肩" },
    jingchen: { name: "星焰神·烬辰", card: "jingchen", note: "十六道日芒光环，掌上小太阳" },
    squire: { name: "晨曦侍从", card: "squire", note: "马尾少女，太阳圆盾" },
    paladin: { name: "圣光裁决者", card: "paladin", note: "日冕王冠，巨剑鸢盾" },
    solaris: { name: "逐日者·索拉", card: "solaris", note: "脑后旋转的日轮" },
    aurion: { name: "曙日神·奥瑞恩", card: "aurion", note: "日盘光环，双手巨剑" },
  };
  const GROUPS = [
    ["人形 · 近战", ["huntress", "guard", "skeleton", "assassin", "reaper", "leech", "squire", "paladin", "solaris", "frostking"]],
    ["人形 · 远程", ["vesper", "spark", "necromancer", "soulguide", "oracle", "nyx"]],
    ["有翼", ["sentinel", "dragon", "phoenix", "wisp"]],
    ["野兽与虫", ["wolf", "pup", "spiritwolf", "moonfox", "eclipsewolf", "duskstag", "rider", "spider"]],
    ["巨像", ["golem", "treant", "moonguard"]],
    ["神", ["selmyra", "fenlos", "jingchen", "aurion"]],
  ];
  const ALL = GROUPS.flatMap((g) => g[1]).filter((id) => KIT.get(id));
  const groupOf = (id) => GROUPS.find((g) => g[1].includes(id))?.[0] || "";

  // ------------------------------------------------------------------ renderer, room
  // two layers, as on the battlefield: the room (sky, floor, shadows) drawn smooth on a canvas behind, the figures
  // drawn as pixel sprites on a transparent canvas in front (EmberPixelPass: low resolution, outlined)
  const canvas = $("#stage");
  const roomCanvas = document.createElement("canvas"); roomCanvas.id = "room"; roomCanvas.setAttribute("aria-hidden", "true"); canvas.before(roomCanvas);
  const roomRenderer = new THREE.WebGLRenderer({ canvas: roomCanvas, antialias: true, powerPreference: "high-performance" });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
  for (const r of [roomRenderer, renderer]) { r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping; }
  renderer.setClearColor(0, 0);
  const pass = EmberPixelPass.create(renderer);
  const dpr = () => Math.min(devicePixelRatio || 1, 2);
  roomRenderer.setPixelRatio(dpr()); renderer.setPixelRatio(EmberPixelPass.PIX);
  const scene = new THREE.Scene(), room = new THREE.Scene();
  const quad = (fs, extra = {}) => new THREE.ShaderMaterial({ vertexShader: "varying vec3 p; varying vec2 u; void main(){ p = position; u = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }", fragmentShader: fs, depthWrite: false, ...extra });
  {
    // dusk: a warm glow low behind the stage, mauve slate above (display-referred, like the figures)
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), quad("varying vec3 p; void main(){ vec3 d = normalize(p); float y = d.y; vec3 lo = vec3(0.075,0.068,0.07), hz = vec3(0.22,0.14,0.11), hi = vec3(0.045,0.05,0.075); vec3 c = mix(lo, hz, smoothstep(-0.1, 0.0, y)); c = mix(c, hi, smoothstep(0.0, 0.32, y)); float g = exp(-pow(atan(d.x, -d.z) * 0.9, 2.0)) * exp(-abs(y) * 8.0); c += vec3(0.5, 0.25, 0.11) * g * 0.3; gl_FragColor = vec4(c, 1.); }", { side: THREE.BackSide }));
    room.add(sky);
    // the board's dark stone, worn lighter where the figures stand, fading into the dusk
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 120), quad("varying vec2 u; float h(vec2 p){ return fract(sin(dot(p, vec2(12.99, 78.23))) * 43758.5); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); } void main(){ float d = length(u); float s = n(u * 2.6) * 0.55 + n(u * 9.0) * 0.3 + n(u * 31.0) * 0.15; vec2 g = abs(fract(u * 1.25) - 0.5); float seam = smoothstep(0.47, 0.5, max(g.x, g.y)); vec3 c = mix(vec3(0.12,0.11,0.115), vec3(0.23,0.21,0.2), s); c *= 1.0 - 0.28 * seam; c *= 1.2 - 0.95 * smoothstep(1.2, 8.5, d); gl_FragColor = vec4(c, 1.); }"));
    floor.rotation.x = -Math.PI / 2;
    room.add(floor);
  }
  const shadowMat = quad("varying vec2 u; void main(){ float d = length(u); gl_FragColor = vec4(0.,0.,0., 0.55 * (1. - smoothstep(0.1, 1., d))); }", { transparent: true });
  const shadows = new Map();
  function shadowFor(u) {
    let s = shadows.get(u.k);
    if (!s) { s = new THREE.Mesh(new THREE.CircleGeometry(1, 32), shadowMat); s.rotation.x = -Math.PI / 2; room.add(s); shadows.set(u.k, s); }
    const k = u.fig.root.scale.x, wide = u.fig.kind !== "humanoid";
    s.scale.set(0.24 * k * (wide ? 1.35 : 1), 0.24 * k * (wide ? 1.6 : 1), 1);
    return s;
  }

  // a straw training dummy for the solo view (lit by its own lights; the figures grade themselves and ignore them)
  const dummy = new THREE.Group();
  {
    scene.add(new THREE.HemisphereLight(0x8d8aa8, 0x3a2a20, 1.1));
    const key = new THREE.DirectionalLight(0xffc48a, 1.6); key.position.set(-2, 4, 3); scene.add(key);
    const box = (w, h, d, c, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); dummy.add(m); return m; };
    box(0.07, 0.62, 0.07, 0x5a3a22, 0, 0.31, 0);                // post
    box(0.34, 0.4, 0.22, 0xc9a45c, 0, 0.62, 0);                 // straw body
    box(0.36, 0.05, 0.24, 0x6b4a2a, 0, 0.6, 0);                 // rope belt
    box(0.52, 0.06, 0.06, 0x5a3a22, 0, 0.74, 0);                // arms
    box(0.2, 0.2, 0.2, 0xb39468, 0, 0.93, 0);                   // burlap head
    box(0.04, 0.04, 0.02, 0x2a1d14, -0.05, 0.95, 0.1); box(0.04, 0.04, 0.02, 0x2a1d14, 0.05, 0.95, 0.1);
    box(0.3, 0.04, 0.3, 0x3a2a1c, 0, 0.02, 0);                  // base
    dummy.visible = false; dummy.userData.hit = -1; scene.add(dummy);
  }

  // ------------------------------------------------------------------ the arena (the battlefield's behaviour)
  const POS = new Map();                                    // "side:uid" → ground point
  const arena = A.create(scene, { size: 1, shots: true, pixelRatio: dpr, bake: (id) => EmberVoxelBaker.bake(id), where: (ref) => POS.get(A.key(ref.side, ref.uid)) || null });
  const DUMMY = { side: "e", uid: "dummy" };

  // ------------------------------------------------------------------ camera: orbit
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 200);
  const view = { yaw: 0, pitch: 12, dist: 9, ty: 0.55, tx: 0, want: null, spin: false };
  const VIEWS = { all: { yaw: 0, pitch: 21, dist: 11.5, ty: 0.45, tx: 0 }, solo: { yaw: -18, pitch: 9, dist: 4.4, ty: 0.5, tx: 0.35 }, duel: { yaw: 0, pitch: 12, dist: 6.2, ty: 0.5, tx: 0 } };
  function placeCam() {
    const y = (view.yaw * Math.PI) / 180, p = (view.pitch * Math.PI) / 180;
    cam.position.set(view.tx + view.dist * Math.sin(y) * Math.cos(p), view.ty + view.dist * Math.sin(p), view.dist * Math.cos(y) * Math.cos(p));
    cam.lookAt(view.tx, view.ty, 0);
  }
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, moved: false }; canvas.setPointerCapture(e.pointerId); view.want = null; });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) { drag.moved = true; view.spin = false; syncSpin(); }
    view.yaw = drag.yaw - dx * 0.35; view.pitch = Math.max(-2, Math.min(55, drag.pitch + dy * 0.25));
  });
  canvas.addEventListener("pointerup", (e) => { if (drag && !drag.moved) pick(e); drag = null; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); view.dist = Math.max(2.2, Math.min(18, view.dist * Math.exp(e.deltaY * 0.001))); view.want = null; }, { passive: false });
  canvas.addEventListener("dblclick", () => { view.want = { ...VIEWS[mode] }; });

  // ------------------------------------------------------------------ modes
  let mode = "all", sel = ALL.includes("huntress") ? "huntress" : ALL[0], duel = { a: "guard", b: "skeleton" }, slot = "a", busyUntil = 0;
  const unitsIn = () => { const out = []; arena.each((u) => out.push(u)); return out; };
  function clear() { for (const u of unitsIn()) arena.drop(u.side, u.uid, false); for (const s of shadows.values()) scene.remove(s); shadows.clear(); POS.clear(); }
  function stage(side, uid, id, at) { POS.set(A.key(side, uid), at); arena.set(side, uid, id); }
  let lineup = 8, rowsN = 3;
  /** frame each view for this screen: on a wide screen the roster covers the left, so the subject is centred in what
   *  is left; on a phone the roster and actions take the bottom, so the subject sits in the upper part */
  function fitAll() {
    const W = Math.max(1, canvas.clientWidth), H = Math.max(1, canvas.clientHeight), wide = W > 760, fovT = Math.tan((cam.fov * Math.PI) / 360);
    // the part of the screen the stage really has: the roster takes the left on a wide screen, the bottom on a phone
    const freeW = wide ? W - 256 : W, freeH = wide ? H : H * 0.62;
    // distance at which `span` world units fill `fill` of the free width (and the figure height fits the free height)
    const fit = (span, tall, fill) => Math.max((span / fill) * H / (2 * fovT * freeW), (tall / 0.8) * H / (2 * fovT * freeH));
    VIEWS.all.dist = fit(lineup + 1.2, 1.9 + 0.55 * rowsN, 0.94);
    VIEWS.solo.dist = fit(narrow() ? 2.2 : 2.6, 1.3, 0.9);
    VIEWS.duel.dist = fit(narrow() ? 2.1 : 3.3, 1.3, 0.92);
    const base = { all: [0, 0.45], solo: [narrow() ? 0.45 : 0.8, 0.5], duel: [0, 0.5] };
    for (const k of ["all", "solo", "duel"]) {
      const d = VIEWS[k].dist, ppu = H / (2 * d * fovT);
      VIEWS[k].tx = base[k][0] - (wide ? 128 / ppu : 0);
      VIEWS[k].ty = base[k][1] - (wide ? 0 : (H - freeH) / 2 / ppu);   // lift the subject into the free top part
    }
    if (!drag) view.want = { ...VIEWS[mode], yaw: view.want?.yaw ?? VIEWS[mode].yaw };
  }
  const narrow = () => cam.aspect < 0.9;
  function setMode(m) {
    mode = m; clear(); dummy.visible = m === "solo";
    if (m === "all") {
      // a group photo in three rows by size: small ones in front, people in the middle, the big ones at the back; each
      // row sits in the gaps of the row in front of it
      // small ones in front, the big ones and the gods at the back; a phone takes the same order in rows of four
      const ORDER = [["wolf", "pup", "moonfox", "spider", "spiritwolf", "wisp", "skeleton"],
        ["spark", "squire", "huntress", "assassin", "leech", "vesper", "necromancer"],
        ["oracle", "soulguide", "nyx", "paladin", "guard", "reaper", "solaris"],
        ["duskstag", "rider", "eclipsewolf", "sentinel", "phoenix", "frostking", "dragon"],
        ["golem", "treant", "moonguard", "selmyra", "fenlos", "jingchen", "aurion"]];
      const flat = ORDER.flat();
      const ROWS = narrow() ? Array.from({ length: Math.ceil(flat.length / 4) }, (_, r) => flat.slice(r * 4, r * 4 + 4)) : ORDER;
      const placed = new Set(), gap = narrow() ? 1.25 : 1.5, dz = narrow() ? 1.0 : 1.3, r0 = (ROWS.length - 1) / 2;
      ROWS.forEach((row, r) => {
        const ids = row.filter((id) => ALL.includes(id)); ids.forEach((id) => placed.add(id));
        ids.forEach((id, i) => stage(r ? "e" : "p", id, id, V3((i - (ids.length - 1) / 2) * gap + (r % 2 ? gap / 4 : -gap / 4), 0, (r0 - r) * dz)));
      });
      ALL.filter((id) => !placed.has(id)).forEach((id, i) => stage("e", id, id, V3((i - 1) * gap, 0, -2.8)));   // any figure added later
      lineup = Math.max(...ROWS.map((r) => r.length)) * gap; rowsN = ROWS.length; fitAll();
    } else if (m === "solo") {
      // on a phone the dummy stands behind and to the side, so the pair fits a narrow screen
      const dp = narrow() ? V3(0.85, 0, -1.0) : V3(1.6, 0, -0.3);
      stage("p", "solo", sel, V3(0, 0, 0));
      POS.set(A.key(DUMMY.side, DUMMY.uid), dp);
      dummy.position.copy(dp); dummy.rotation.set(0, -0.9, 0);
    } else {
      stage("p", "a", duel.a, narrow() ? V3(-0.55, 0, 0.8) : V3(-1.15, 0, 0.3));
      stage("e", "b", duel.b, narrow() ? V3(0.55, 0, -0.8) : V3(1.15, 0, -0.3));
    }
    view.want = { ...VIEWS[m] }; view.spin = m === "solo" && !matchMedia("(prefers-reduced-motion: reduce)").matches; syncSpin();
    render();
  }
  function pick(e) {
    if (mode !== "all") return;
    const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = null, bd = 60;
    for (const u of unitsIn()) {
      if (!u.fig) continue;
      const p = u.fig.root.position.clone().add(V3(0, 0.45 * u.fig.root.scale.x, 0)).project(cam);
      const sx = (p.x * 0.5 + 0.5) * rect.width, sy = (-p.y * 0.5 + 0.5) * rect.height, d = Math.hypot(sx - mx, sy - my);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) choose(best.id, true);
  }
  function choose(id, open) {
    if (mode === "duel") { duel[slot] = id; if (slot === "a") slot = "b"; setMode("duel"); return; }
    sel = id;
    if (open || mode === "solo") setMode("solo"); else render();
  }

  // ------------------------------------------------------------------ the director (as effects.js + combat.js plan it)
  const ref = (side, uid) => ({ side, uid });
  const later = (ms, fn) => setTimeout(fn, ms);
  function attack(from, to, tier, lethal) {
    const u = arena.unit(from.side, from.uid);
    if (!u || u.state !== "live" || performance.now() < busyUntil) return;
    const m = u.spec.moves?.attack || {}, ranged = !!m.ranged, style = m.style || (ranged ? "arrow" : "slash");
    const a = POS.get(A.key(from.side, from.uid)), b = POS.get(A.key(to.side, to.uid));
    const stop = TIMING.stop[tier];
    let lift, contact;
    if (ranged) {
      lift = TIMING.recoil + (m.windup ?? 260);
      const px = a && b ? a.distanceTo(b) * 150 : 300;
      contact = lift + Math.max(TIMING.flightMin, Math.min(TIMING.flightMax, (px / TIMING.speed) * 1000));
    } else { lift = TIMING.lift; contact = lift + TIMING.lunge; }
    const release = contact + stop, duration = release + (ranged ? 0 : TIMING.recover);
    arena.cue(from.side, from.uid, "attack", { toward: to, planned: true, ranged, tier, liftMs: lift, contactMs: contact, releaseMs: release, durationMs: duration });
    if (ranged) SFX.play(style === "breath" ? "breath" : style === "bolt" ? "zap" : "twang", lift / 1000);
    else SFX.play(tier >= 3 ? "swingHeavy" : "swing", Math.max(0, contact - 190) / 1000);
    later(contact, () => {
      arena.contact(to, { tier, from, direction: "outgoing" });
      if (to === DUMMY) dummy.userData.hit = performance.now();
      SFX.play(tier >= 3 ? "hitHeavy" : "hit");
    });
    busyUntil = performance.now() + duration + 150;
    if (lethal && arena.unit(to.side, to.uid)) {
      const id = arena.unit(to.side, to.uid).id;
      later(release + TIMING.deathDelay, () => { if (arena.cue(to.side, to.uid, "death")) SFX.play("shatter", 0.15); });
      later(release + TIMING.deathDelay + 1300, () => respawn(to.side, to.uid, id));
      busyUntil = performance.now() + release + TIMING.deathDelay + 1300 + 700;
    }
  }
  function respawn(side, uid, id) {
    if (!POS.has(A.key(side, uid))) return;
    arena.set(side, uid, id);
    SFX.play("assemble", 0.05, { len: 0.55 });
  }
  const soloRef = () => ref("p", "solo");
  const ACTIONS = {
    solo: [
      ["攻击", "attack", () => attack(soloRef(), DUMMY, 2, false)],
      ["重击", "heavy", () => attack(soloRef(), DUMMY, 3, false)],
      ["受击", "hurt", () => { arena.contact(soloRef(), { tier: 2, from: DUMMY, direction: "outgoing" }); SFX.play("hit"); }],
      ["胜利", "victory", () => arena.cue("p", "solo", "victory")],
      ["碎裂", "shatter", () => { const u = arena.unit("p", "solo"); if (!u || u.state !== "live") return; arena.contact(soloRef(), { tier: 3, from: DUMMY, direction: "outgoing" }); SFX.play("hitHeavy"); later(TIMING.deathDelay + 90, () => { if (arena.cue("p", "solo", "death")) SFX.play("shatter", 0.15); }); later(1500, () => respawn("p", "solo", u.id)); }],
      ["拼合登场", "assemble", () => { const u = arena.unit("p", "solo"); if (!u) return; arena.drop("p", "solo", false); later(30, () => respawn("p", "solo", u.id)); }],
    ],
    duel: [
      ["A 普攻", "a1", () => attack(ref("p", "a"), ref("e", "b"), 1, false)],
      ["A 重击", "a2", () => attack(ref("p", "a"), ref("e", "b"), 2, false)],
      ["A 致死", "a3", () => attack(ref("p", "a"), ref("e", "b"), 3, true)],
      ["B 反击", "b2", () => attack(ref("e", "b"), ref("p", "a"), 2, false)],
      ["B 致死", "b3", () => attack(ref("e", "b"), ref("p", "a"), 3, true)],
      ["交换", "swap", () => { duel = { a: duel.b, b: duel.a }; setMode("duel"); }],
    ],
  };

  // ------------------------------------------------------------------ page
  const roster = $("#roster"), dock = $("#actions"), info = $("#info"), labels = $("#labels");
  function render() {
    for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === mode));
    // roster
    roster.innerHTML = GROUPS.map(([g, ids]) => {
      const rows = ids.filter((id) => KIT.get(id)).map((id) => {
        const on = mode === "duel" ? duel.a === id || duel.b === id : mode === "solo" && sel === id;
        const tag = mode === "duel" ? (duel.a === id ? '<span class="slot a">A</span>' : duel.b === id ? '<span class="slot b">B</span>' : "") : "";
        return `<button class="who" type="button" data-id="${id}" aria-pressed="${on}"><span class="who-name">${INFO[id]?.name || id}</span><span class="who-note">${INFO[id]?.note || ""}</span>${tag}</button>`;
      }).join("");
      return rows ? `<div class="shelf"><div class="shelf-name">${g}</div>${rows}</div>` : "";
    }).join("");
    // actions
    const acts = ACTIONS[mode] || [];
    dock.innerHTML = acts.map(([label, key]) => `<button class="act${/3|shatter/.test(key) ? " lethal" : ""}" type="button" data-act="${key}">${label}</button>`).join("")
      + (mode === "solo" ? `<button class="act quiet" type="button" data-act="spin" aria-pressed="${view.spin}">自动旋转</button>` : "")
      + (mode === "duel" ? `<span class="slot-pick">名册点选设为 <button class="slotbtn" type="button" data-slot="a" aria-pressed="${slot === "a"}">A</button><button class="slotbtn" type="button" data-slot="b" aria-pressed="${slot === "b"}">B</button></span>` : "")
      + (mode === "all" ? `<span class="hint">点一个角色进入单人展示 · 拖动旋转 · 滚轮缩放</span>` : "");
    renderInfo();
  }
  function statsOf(id) {
    const b = R.cached(id);
    return b ? { tris: b.main.stats.tris + b.props.reduce((n, p) => n + p.bake.stats.tris, 0), ms: Math.round(b.ms) } : null;
  }
  function card(id, role) {
    const spec = KIT.get(id), m = spec?.moves?.attack || {}, st = statsOf(id);
    const style = STYLE[m.style || (m.ranged ? "arrow" : "slash")] || "近战";
    return `<div class="card glass">${role ? `<div class="role">${role}</div>` : ""}<div class="name">${INFO[id]?.name || id}</div>
      <div class="meta"><span>${groupOf(id)}</span><span>${m.ranged ? "远程" : "近战"} · ${style}</span><span class="mono">${INFO[id]?.card || id}</span></div>
      ${st ? `<dl class="nums"><div><dt>三角面</dt><dd>${st.tris.toLocaleString("en-US")}</dd></div><div><dt>烘焙</dt><dd>${st.ms} ms</dd></div></dl>` : `<div class="baking">正在生成像素角色…</div>`}</div>`;
  }
  function renderInfo() {
    if (mode === "solo") info.innerHTML = card(sel);
    else if (mode === "duel") info.innerHTML = card(duel.a, "A · 我方") + card(duel.b, "B · 敌方");
    else info.innerHTML = `<div class="card glass"><div class="role">全员</div><div class="name">${ALL.length} 个像素角色</div><div class="meta"><span>同一套像素尺寸</span><span>同一套三阶光影</span><span>战场同款打击感</span></div></div>`;
  }
  roster.addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) choose(b.dataset.id, mode === "all"); });
  dock.addEventListener("click", (e) => {
    const s = e.target.closest("[data-slot]"); if (s) { slot = s.dataset.slot; render(); return; }
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "spin") { view.spin = !view.spin; syncSpin(); return; }
    (ACTIONS[mode] || []).find((a) => a[1] === b.dataset.act)?.[2]();
  });
  for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setMode(b.dataset.mode));
  const snd = $("#sound");
  snd.addEventListener("click", () => { SFX.enable(!SFX.on); snd.setAttribute("aria-pressed", String(SFX.on)); snd.querySelector("span").textContent = SFX.on ? "声音 开" : "声音 关"; });
  function syncSpin() { const b = document.querySelector('[data-act="spin"]'); if (b) b.setAttribute("aria-pressed", String(view.spin)); }
  // name tags under the figures in the all-figures view (they follow the camera)
  function tags() {
    if (mode !== "all") { if (labels.childElementCount) labels.innerHTML = ""; return; }
    const rect = canvas.getBoundingClientRect(), us = unitsIn().filter((u) => u.fig && u.state !== "baking");
    if (labels.childElementCount !== us.length) labels.innerHTML = us.map((u) => `<button type="button" class="tag" data-id="${u.id}">${INFO[u.id]?.name || u.id}</button>`).join("");
    us.forEach((u, i) => {
      const el = labels.children[i]; if (!el) return;
      const p = u.fig.root.position.clone().project(cam);
      el.style.transform = `translate(${((p.x * 0.5 + 0.5) * rect.width).toFixed(1)}px, ${((-p.y * 0.5 + 0.5) * rect.height + 10).toFixed(1)}px) translateX(-50%)`;
    });
  }
  labels.addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) choose(b.dataset.id, true); });

  // ------------------------------------------------------------------ frames
  let last = 0, lastInfo = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (roomCanvas.width !== Math.round(w * dpr()) || roomCanvas.height !== Math.round(h * dpr())) {
      roomRenderer.setPixelRatio(dpr()); roomRenderer.setSize(w, h, false);
      renderer.setPixelRatio(EmberPixelPass.PIX); renderer.setSize(w, h, false); arena.setPixelRatio(dpr());
      const was = narrow();
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
      if (was !== narrow() && mode !== "solo") setMode(mode);   // crossed the phone breakpoint: lay the room out again
      else fitAll();                                       // refit the views to the new shape
    }
    if (view.want) {
      const k = 1 - Math.exp(-dt * 5);
      for (const key of ["yaw", "pitch", "dist", "ty", "tx"]) view[key] += (view.want[key] - view[key]) * k;
      if (Math.abs(view.want.dist - view.dist) < 0.01 && Math.abs(view.want.yaw - view.yaw) < 0.05) view.want = null;
    }
    if (view.spin && !drag) view.yaw += dt * 9;
    placeCam();
    if (dummy.visible && dummy.userData.hit >= 0) {           // the dummy rocks on its post and settles
      const t = (now - dummy.userData.hit) / 1000;
      dummy.rotation.z = t < 1.2 ? 0.22 * Math.exp(-t * 4.5) * Math.sin(t * 22) : 0;
    }
    arena.step(now, cam, dt);
    // blob shadows under every standing figure
    const seen = new Set();
    for (const u of unitsIn()) {
      if (!u.fig || !u.fig.root.visible) continue;
      const s = shadowFor(u); s.position.set(u.fig.root.position.x, 0.004, u.fig.root.position.z); s.visible = true; seen.add(u.k);
    }
    for (const [k, s] of shadows) if (!seen.has(k)) s.visible = false;
    roomRenderer.render(room, cam);
    pass.render(scene, cam);
    tags();
    if (now - lastInfo > 500) { lastInfo = now; if (info.querySelector(".baking")) renderInfo(); }
  }
  // the page opens with everyone: they assemble as they bake, one per task
  cam.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  setMode("all");
  requestAnimationFrame(frame);
  window.Gallery = { arena, setMode, choose, attack, view, get mode() { return mode; } };
})();
