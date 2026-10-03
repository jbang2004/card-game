/* 招式审片台 — one figure's moves, played by the battlefield's own code (EmberVoxelArena on the director's beats,
 * as tools/model-demo does), on a clock the viewer holds: pause, step a frame, jump to any moment, play at a tenth of
 * the speed. What plays is named as it plays — the phase of the move sheet (content/moves.js), the millisecond, the
 * clip frame, the effects on — so a change can be asked for in the sheet's own words; a moment can be marked (its
 * numbers and a screenshot go to tools/move-review/marks/). The sheets are read again the moment they are saved, and
 * the version they replaced can play beside the current one (the same page, embedded, on the kept revision).
 *
 * Everything runs on a virtual clock (performance.now is this page's) and a seeded Math.random, so a take is the same
 * every time: jumping to a moment replays the take up to it. tools/move-review/audit.cjs drives the same page. */
(() => {
  const THREE = EmberVesperThree, A = EmberVoxelArena, C = EmberVoxelClips, SFX = EmberGallerySfx, MS = EmberMoveSheet, MF = EmberModelFigures;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const Q = new URLSearchParams(location.search), EMBED = Q.get("embed") === "1", REV = Q.get("rev") || "";
  if (EMBED) document.body.classList.add("embed");
  // the director's beats (src/presentation/timing.js): the hit-stop by tier, the melee lift and lunge, a shot's flight
  const TIMING = { stop: [0, 0, 50, 90], lift: MS.DIRECTOR.lift, lunge: MS.DIRECTOR.lunge, recover: 200, deathDelay: 120, recoil: MS.DIRECTOR.recoil, speed: 1800, flightMin: 90, flightMax: 220 };
  const STEP = 1000 / 60, TAIL = 700, SEED = 20261002;
  let ID = Q.get("who") || "paladin", FOE_ID = Q.get("foe") || "squire";

  // ------------------------------------------------------------------ the clock, the dice
  const real = performance.now.bind(performance);
  let vt = real();
  performance.now = () => vt;                                  // the arena and its effects stamp everything with it
  const clock = { speed: 1, paused: false, loop: true, busy: false };
  let seed = SEED;
  Math.random = () => { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const jobs = [];
  const later = (ms, fn) => jobs.push({ at: vt + ms, fn });
  // (a job due at this very instant runs: a jump to "the contact" must not hang on the last bit of a float)
  const runJobs = () => { for (let i = 0; i < jobs.length; ) { if (jobs[i].at <= vt + 0.01) jobs.splice(i, 1)[0].fn(); else i++; } };
  let quiet = false;                                           // no sound while a take is run forward to a moment
  const snd = (kind, delayMs = 0, opts) => { if (!quiet && !EMBED) SFX.play(kind, delayMs / 1000 / clock.speed, opts); };

  // ------------------------------------------------------------------ room and renderers
  const canvas = $("#stage");
  const roomCanvas = document.createElement("canvas"); roomCanvas.id = "room"; canvas.before(roomCanvas);
  const roomRenderer = new THREE.WebGLRenderer({ canvas: roomCanvas, antialias: true, preserveDrawingBuffer: true });
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
  for (const r of [roomRenderer, renderer]) { r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping; }
  renderer.setClearColor(0, 0);
  const pass = EmberPixelPass.create(renderer, { up: true });
  const dpr = () => Math.min(devicePixelRatio || 1, 2);
  const room = new THREE.Scene();
  let scene = new THREE.Scene();                                   // the figures and their effects: a new one with each arena
  const quad = (fs, extra = {}) => new THREE.ShaderMaterial({ vertexShader: "varying vec3 p; varying vec2 u; void main(){ p = position; u = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }", fragmentShader: fs, depthWrite: false, ...extra });
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), quad("varying vec3 p; void main(){ vec3 d = normalize(p); float y = d.y; vec3 lo = vec3(0.075,0.068,0.07), hz = vec3(0.22,0.14,0.11), hi = vec3(0.045,0.05,0.075); vec3 c = mix(lo, hz, smoothstep(-0.1, 0.0, y)); c = mix(c, hi, smoothstep(0.0, 0.32, y)); float g = exp(-pow(atan(d.x, -d.z) * 0.9, 2.0)) * exp(-abs(y) * 8.0); c += vec3(0.5, 0.25, 0.11) * g * 0.3; gl_FragColor = vec4(c, 1.); }", { side: THREE.BackSide }));
    const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 120), quad("varying vec2 u; float h(vec2 p){ return fract(sin(dot(p, vec2(12.99, 78.23))) * 43758.5); } float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); } void main(){ float d = length(u); float s = n(u * 2.6) * 0.55 + n(u * 9.0) * 0.3 + n(u * 31.0) * 0.15; vec2 g = abs(fract(u * 1.25) - 0.5); float seam = smoothstep(0.47, 0.5, max(g.x, g.y)); vec3 c = mix(vec3(0.12,0.11,0.115), vec3(0.23,0.21,0.2), s); c *= 1.0 - 0.28 * seam; c *= 1.2 - 0.95 * smoothstep(1.2, 7.0, d); gl_FragColor = vec4(c, 1.); }"));
    floor.rotation.x = -Math.PI / 2;
    room.add(sky, floor);
  }
  const dimmer = $("#dimmer");
  const shadowMat = quad("varying vec2 u; void main(){ float d = length(u); gl_FragColor = vec4(0.,0.,0., 0.5 * (1. - smoothstep(0.1, 1., d))); }", { transparent: true });

  // ------------------------------------------------------------------ the arena
  const HERO = { side: "p", uid: "hero" }, FOE = { side: "e", uid: "foe" };
  const POS = new Map([[A.key("p", "hero"), V3(-0.55, 0, 0.45)], [A.key("e", "foe"), V3(0.55, 0, -0.45)]]);
  // (an arena leaves its effects' meshes behind when it is disposed: each gets a scene of its own, and the old one's
  // buffers are let go)
  function makeArena() {
    scene.traverse((o) => { o.geometry?.dispose?.(); for (const m of [].concat(o.material || [])) m.dispose?.(); });
    scene = new THREE.Scene();
    return A.create(scene, {
      size: 1, pixelRatio: dpr, fxLayer: 2, shots: true,           // the page flies spell bolts itself (the battle leaves them to EmberFx2)
      where: (ref) => POS.get(A.key(ref.side, ref.uid)) || null,
      base: () => ({ r: 0.34, state: {} }),
    });
  }
  let arena = makeArena();                                         // (made anew for each figure chosen: no take inherits another's clock or effects)
  const shadows = new Map();
  const unit = (r) => arena.unit(r.side, r.uid);
  const idOf = (r) => (r === HERO ? ID : FOE_ID);
  const enter = (r) => { arena.set(r.side, r.uid, idOf(r)); snd("assemble", 50, { len: 0.55 / clock.speed }); };

  // ------------------------------------------------------------------ camera
  const cam = new THREE.PerspectiveCamera(24, 1, 0.05, 200);
  const VIEWS = {
    // the battle camera, as the game sees a fight (EmberBattleView's versus, 2026-10-03): 50° down and square to the
    // line between the two (POS: yaw 39°), the figure on the left, its foe on the right, level — two units of facing rows
    battle: { yaw: 39, pitch: 50, dist: 5.8, tx: 0, ty: 0.3, tz: 0 },
    front: { yaw: -150, pitch: 16, dist: 5.4, tx: -0.1, ty: 0.5, tz: 0 },     // from behind its foe's shoulder: its face
    side: { yaw: -90, pitch: 12, dist: 5.4, tx: 0, ty: 0.5, tz: 0 },
    close: { yaw: -160, pitch: 10, dist: 2.7, tx: -0.55, ty: 0.55, tz: 0.45 },
    top: { yaw: -129, pitch: 58, dist: 4.6, tx: 0, ty: 0.3, tz: 0 },          // from above, across the line of the blow: who stands where
  };
  let viewName = VIEWS[Q.get("view")] ? Q.get("view") : "front";
  const view = { ...VIEWS[viewName], want: null, spin: false };
  function placeCam() {
    const y = (view.yaw * Math.PI) / 180, p = (view.pitch * Math.PI) / 180, d = view.dist * Math.max(1, 1.1 / Math.max(0.3, cam.aspect));
    cam.position.set(view.tx + d * Math.sin(y) * Math.cos(p), view.ty + d * Math.sin(p), view.tz + d * Math.cos(y) * Math.cos(p));
    cam.lookAt(view.tx, view.ty, view.tz);
  }
  function setView(name, snap = false) {
    viewName = name;
    if (snap) { Object.assign(view, VIEWS[name]); view.want = null; }
    else { view.want = { ...VIEWS[name] }; if (Math.abs(view.want.yaw - view.yaw) > 180) view.yaw += 360 * Math.sign(view.want.yaw - view.yaw); }
    for (const b of $$("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === name));
    tell({ cmd: "view", name });
  }
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch }; canvas.setPointerCapture(e.pointerId); view.want = null; openPop(null); });
  canvas.addEventListener("pointermove", (e) => { if (!drag) return; view.yaw = drag.yaw - (e.clientX - drag.x) * 0.35; view.pitch = Math.max(-2, Math.min(60, drag.pitch + (e.clientY - drag.y) * 0.25)); tellCam(); });
  canvas.addEventListener("pointerup", () => { drag = null; });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); view.dist = Math.max(1.4, Math.min(12, view.dist * Math.exp(e.deltaY * 0.001))); view.want = null; tellCam(); }, { passive: false });
  canvas.addEventListener("dblclick", () => setView(viewName));

  // ------------------------------------------------------------------ one step of the world
  function tick(dtMs) {
    vt += dtMs;
    runJobs();
    arena.step(vt, cam, dtMs / 1000);
  }
  /** the world run forward by ms without drawing it */
  function ff(ms) { for (let t = 0; t < ms - 1e-6; t += STEP) tick(Math.min(STEP, ms - t)); }

  // ------------------------------------------------------------------ takes
  /** an attack as effects.js + combat.js plan it — melee: lift → lunge → contact (hit-stop) → release → recover;
   *  ranged: recoil + wind-up → the bolt's flight → contact → { lift, contact, release, duration, ranged } */
  function attack(from, to, tier, lethal) {
    const u = unit(from);
    if (!u || u.state !== "live") return null;
    const m = u.spec.moves?.attack || {}, ranged = !!m.ranged, stop = TIMING.stop[tier];
    let lift, contact;
    if (ranged) {
      const a = POS.get(A.key(from.side, from.uid)), b = POS.get(A.key(to.side, to.uid));
      lift = TIMING.recoil + (u.fig?.spell?.windup ?? u.fig?.sig?.draw ?? m.windup ?? 260);
      contact = lift + Math.max(TIMING.flightMin, Math.min(TIMING.flightMax, ((a.distanceTo(b) * 150) / TIMING.speed) * 1000));
    } else { lift = TIMING.lift + (u.fig?.sig?.windup ?? 0); contact = lift + TIMING.lunge; }
    const release = contact + stop, duration = release + (ranged ? 0 : TIMING.recover);
    arena.cue(from.side, from.uid, "attack", { toward: to, planned: true, ranged, tier, liftMs: lift, contactMs: contact, releaseMs: release, durationMs: duration });
    if (ranged) snd(m.style === "bolt" ? "zap" : "twang", lift); else snd(tier >= 3 ? "swingHeavy" : "swing", Math.max(0, contact - 190));
    const sig = u.fig?.sig;
    if (sig) snd("charge", 0, { len: (lift * 0.9) / 1000 / clock.speed });
    later(contact, () => {
      arena.contact(to, { tier, from, direction: "outgoing" }); snd(tier >= 3 ? "hitHeavy" : "hit");
      if (sig) snd("elem", 0, { kind: sig.fx?.pal, heavy: tier >= 3 }); else if (unit(to)?.fig?.sig) snd("block");
    });
    if (lethal) later(release + TIMING.deathDelay, () => { if (arena.cue(to.side, to.uid, "death")) snd("shatter", 150); });
    // the take lasts until its clip has played out: the part after the blow runs at speed from the blow (and its hit-stop)
    const tm = C.timing(u.fig), hold = ranged ? 0 : ((sig?.hitstop?.[tier] ?? A.TIER[tier].freeze) * 1000) / 60;
    return { lift, contact, release, duration, ranged, tier, len: Math.max(duration, (ranged ? lift : contact) + hold + (tm.length - tm.hit) * 1000) + (lethal ? 900 : 0) };
  }
  // what can be played: label, who strikes, and what it is called while it plays
  const ACTS = {
    attack: { label: "攻击", run: () => attack(HERO, FOE, 2, false), mine: true },
    heavy: { label: "重击", run: () => attack(HERO, FOE, 3, false), mine: true },
    kill: { label: "致命一击", run: () => attack(HERO, FOE, 3, true), mine: true },
    hurt: { label: "受击", run: () => attack(FOE, HERO, 1, false) },
    hurt3: { label: "重创", run: () => attack(FOE, HERO, 3, false) },
    die: { label: "阵亡", run: () => attack(FOE, HERO, 3, true) },
    victory: { label: "胜利", run: () => { arena.cue("p", "hero", "victory"); return { len: 2400 }; } },
    enter: { label: "登场", run: () => { arena.drop("p", "hero", false); later(30, () => enter(HERO)); return { len: 1100, entering: true }; } },
    idle: { label: "待机", run: () => ({ len: 4000 }) },
  };
  let take = { act: "idle", t0: vt, plan: { len: 4000 }, L: null }, token = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  /** both figures standing (their bakes and shaders are made in real time: wait for them, the world running) */
  async function ensureLive() {
    const live = () => [HERO, FOE].every((r) => unit(r)?.state === "live");
    if (live()) return true;
    // their bakes and shaders are made in real time: wait for those with the world held, then run it a fixed stretch
    // (the arrival), so that the clock a take starts on never depends on how long the waiting took
    for (let i = 0; i < 600; i++) {
      for (const r of [HERO, FOE]) if (!arena.has(r.side, r.uid)) { if (!MF.has(idOf(r)) && typeof EmberModelArt !== "undefined" && EmberModelArt[idOf(r)]) continue; enter(r); }
      if ([HERO, FOE].every((r) => ["arrive", "assembling", "live"].includes(unit(r)?.state))) break;
      await sleep(15);
    }
    ff(900);
    for (let i = 0; i < 40 && !live(); i++) { await sleep(15); ff(100); }
    return live();
  }
  /** play an act from its start — to `toMs` and held there when given (a jump to that moment) */
  async function play(act, toMs = null, o = {}) {
    const my = ++token;
    clock.busy = true; quiet = true;
    // what the last take left (its effects, its blows) plays out unseen: 3.6 s from its blow is enough for all of it
    ff(o.fresh ? 600 : Math.max(600, 3600 - Math.max(0, elapsed() - (take.plan.contact ?? 0))));
    if (!(await ensureLive()) || my !== token) { if (my === token) clock.busy = false; return false; }
    ff(250);
    seed = SEED; jobs.length = 0;
    quiet = toMs != null;
    const t0 = vt, plan = ACTS[act].run() || { len: 1500 };
    take = { act, t0, plan, L: null };
    take.L = layout(take);
    if (plan.entering) {
      // an arrival waits on real timers (its bake, its shaders): the world is held until the figure is there, and the
      // take's clock starts on its arrival
      ff(40);
      for (let i = 0; i < 400 && my === token; i++) { if (["arrive", "assembling", "live"].includes(unit(HERO)?.state)) break; await sleep(10); }
      if (my !== token) return false;
      take.t0 = vt;
    }
    if (toMs != null) { quiet = true; ff(Math.max(0, toMs)); quiet = false; }
    clock.paused = toMs != null ? true : !!o.pause;
    clock.busy = false;
    drawLine(); syncButtons();
    if (!o.told) tell({ cmd: "play", act, toMs, who: ID, foe: FOE_ID });
    return true;
  }
  const elapsed = () => vt - take.t0;
  const seek = (ms) => play(take.act, Math.max(0, ms));

  // ------------------------------------------------------------------ the take's phases on one clock
  const EASE = { io: (x) => x * x * (3 - 2 * x), o: (x) => 1 - (1 - x) * (1 - x), o3: (x) => 1 - Math.pow(1 - x, 3), i2: (x) => x * x, i3: (x) => x * x * x, l: (x) => x };
  /** the hero's attack as the sheet names it, laid on the take's real clock (the hit-stop a segment of its own) */
  function layout(tk) {
    const plan = tk.plan, u = unit(HERO), fig = u?.fig, total = plan.len + TAIL;
    if (!ACTS[tk.act].mine || !fig || !plan.contact) return { total, segs: [{ id: tk.act, label: ACTS[tk.act].label, side: "other", x0: 0, x1: total }], ticks: plan.contact ? [{ x: plan.contact, label: "命中" }] : [], tl: null };
    const tm = C.timing(fig), H = tm.hit;
    const tl = MS.timelineOf(ID) || { lead: H * 1000, total: tm.length * 1000, phases: [{ id: "windup", label: "出手前", side: "before", t0: 0, t1: H * 1000 }, { id: "recover", label: "收招", side: "after", t0: H * 1000, t1: tm.length * 1000 }] };
    const align = plan.ranged ? plan.lift : plan.contact, k = align / tl.lead;
    const stop = plan.ranged ? 0 : ((fig.sig?.hitstop?.[plan.tier] ?? A.TIER[plan.tier].freeze) * 1000) / 60;
    const segs = [];
    for (const p of tl.phases) {
      if (p.side === "before") segs.push({ ...p, x0: p.t0 * k, x1: p.t1 * k });
      else segs.push({ ...p, x0: align + stop + (p.t0 - tl.lead), x1: align + stop + (p.t1 - tl.lead) });
    }
    if (stop > 0) segs.splice(segs.findIndex((s) => s.side === "after"), 0, { id: "hitstop", label: "定帧", side: "stop", x0: align, x1: align + stop });
    // then what the blow leaves is watched a moment longer (the ground cooling, the dust)
    const end = segs[segs.length - 1].x1, last = Math.max(end, plan.contact + 900) + 500;
    segs.push({ id: "linger", label: "余韵", side: "other", x0: end, x1: last });
    const ticks = plan.ranged ? [{ x: plan.lift, label: "出手" }, { x: plan.contact, label: "命中" }] : [{ x: plan.contact, label: "命中" }];
    for (const p of tl.phases) if (p.side === "before" && p.hit && p.t1 < tl.lead) ticks.unshift({ x: p.t1 * k, label: "轻击" });
    return { total: last, segs, ticks, tl, H };
  }
  /** what the hero is doing now, read off its clip time → { phase, nominal (ms on the sheet's clock), frame, frozen } */
  function reading() {
    const u = unit(HERO), L = take.L;
    if (!u?.fig || !L?.tl || u.clip !== "attack") return null;
    const lead = L.tl.lead, nominal = u.t <= L.H ? (u.t / L.H) * lead : lead + (u.t - L.H) * 1000;
    const ph = L.tl.phases.find((p) => nominal >= p.t0 && nominal < p.t1) || L.tl.phases[L.tl.phases.length - 1];
    let frame = null;
    if (ph.frame1 !== undefined) { const q = Math.min(1, Math.max(0, (nominal - ph.t0) / Math.max(1e-6, ph.t1 - ph.t0))); frame = ph.frame0 + (ph.frame1 - ph.frame0) * (EASE[ph.ease] || EASE.l)(q); }
    return { phase: ph, nominal, frame, frozen: u.freeze > 0 };
  }
  // which groups of effects are on at a moment of the hero's attack (the sheet's groups; the blow's linger a while)
  function groupsOn() {
    const u = unit(HERO), on = new Set();
    if (!u?.fig) return on;
    if (u.clip === "idle") on.add("idle");
    if (u.clip === "victory") on.add("victory");
    if (u.clip === "hurt") on.add("hurt");
    const L = take.L;
    if (ACTS[take.act].mine && L?.tl) {
      const e = elapsed(), c = take.plan.ranged ? take.plan.lift : take.plan.contact;
      if (e < c) { on.add("charge"); on.add("cast"); }
      if (e > c * 0.6 && e < c + 160) on.add("weapon");
      if (e >= take.plan.contact && e < take.plan.contact + 1400) on.add("hit");
    }
    return on;
  }

  // ------------------------------------------------------------------ the bar
  const line = $("#line"), head = $("#head");
  function drawLine() {
    const L = take.L; if (!L || EMBED) return;
    for (const el of [...line.querySelectorAll(".ph, .tick")]) el.remove();
    for (const s of L.segs) {
      const el = document.createElement("div");
      el.className = `ph ${s.side}`; el.dataset.id = s.id; el.textContent = s.label;
      el.title = `${s.label} · ${Math.round(s.x1 - s.x0)} ms`;
      el.style.left = (s.x0 / L.total) * 100 + "%"; el.style.width = ((s.x1 - s.x0) / L.total) * 100 + "%";
      line.insertBefore(el, head);
    }
    for (const t of L.ticks) { const el = document.createElement("div"); el.className = "tick"; el.dataset.label = t.label; el.style.left = (t.x / L.total) * 100 + "%"; line.insertBefore(el, head); }
  }
  let scrub = false;
  const lineAt = (e) => { const r = line.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * take.L.total; };
  line.addEventListener("pointerdown", (e) => { scrub = true; line.setPointerCapture(e.pointerId); seek(lineAt(e)); });
  line.addEventListener("pointermove", (e) => { if (scrub && !clock.busy) seek(lineAt(e)); });
  line.addEventListener("pointerup", () => { scrub = false; });
  const phaseEl = $("#phase"), readEl = $("#read"), fxEl = $("#fxnow");
  let lastHud = "";
  function hud() {
    if (EMBED || !take.L) return;
    const e = Math.max(0, elapsed()), L = take.L, r = reading();
    head.style.left = Math.min(100, (e / L.total) * 100) + "%";
    const u = unit(HERO);
    let name, cls, more = "";
    if (r) {
      name = r.frozen ? "定帧" : r.phase.label; cls = r.frozen ? "" : r.phase.side === "after" ? "after" : "";
      more = ` · 招式第 ${Math.round(r.nominal)} ms` + (r.frame != null ? ` · 片段第 ${r.frame.toFixed(1)} 帧` : "");
      for (const el of line.querySelectorAll(".ph")) el.classList.toggle("now", el.dataset.id === (r.frozen ? "hitstop" : r.phase.id));
    } else {
      const c = u?.clip; name = !u || u.state !== "live" ? (take.plan.entering ? "登场" : "…") : c === "hurt" ? "受击" : c === "victory" ? "胜利" : c === "attack" ? ACTS[take.act].label : "待机"; cls = "rest";
      for (const el of line.querySelectorAll(".ph.now")) el.classList.remove("now");
    }
    const on = groupsOn(), txt = `${name}|${cls}|${Math.round(e)}|${more}|${[...on].join()}`;
    if (txt === lastHud) return; lastHud = txt;
    phaseEl.textContent = name; phaseEl.className = cls;
    readEl.textContent = `${ACTS[take.act].label} · 第 ${Math.round(e)} ms${more}`;
    const names = fxNames(on);
    fxEl.textContent = names.length ? "特效：" + names.join(" · ") : "";
    for (const g of $$("#sheet .fxg")) g.classList.toggle("on", on.has(g.dataset.g));
    for (const row of $$("#sheet [data-phase]")) row.classList.toggle("on", !!r && !r.frozen && row.dataset.phase === r.phase.id);
  }

  // ------------------------------------------------------------------ the sheet, read out
  const KEYS = Object.fromEntries(Object.entries(MS.LABELS.fx));
  const word = (v) => (Array.isArray(v) ? v.join(" → ") : v === true ? "有" : v === false ? "无" : typeof v === "string" ? MS.LABELS.value[v] || v : String(v));
  function value(v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const t = [["size", "大小"], ["gain", "亮度"], ["life", "时长"], ["count", "数量"], ["from", "起点"], ["inner", "内缘"]].filter(([k]) => v[k] !== undefined).map(([k, n]) => `${n}×${v[k]}`);
      const rest = Object.entries(v).filter(([k]) => !["kind", "size", "gain", "life", "count", "from", "inner"].includes(k)).map(([k, x]) => `${k} ${Array.isArray(x) ? x.join(",") : x}`);
      return [("kind" in v ? word(v.kind) : ""), ...t, ...rest].filter(Boolean).join(" ") || "有";
    }
    return word(v);
  }
  let effectsNow = [];
  function fxNames(on) { return effectsNow.filter((e) => e.group && on.has(e.group) && e.value !== false && !["hand", "bitsCount", "every", "at"].includes(e.key)).map((e) => e.label); }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  let problems = [];
  function drawSheet() {
    if (EMBED) return;
    const sheet = MS.sheet(ID), el = $("#sheet-body"), S = MS.sheets;
    $("#who-name").textContent = sheet?.name || ID;
    $("#move-name").textContent = sheet ? [sheet.move, MS.LABELS.kind[sheet.kind]].filter(Boolean).join(" · ") : "没有招式单（按代码动作播放）";
    for (const b of $$("[data-act]")) if (b.dataset.act === "attack") b.textContent = sheet?.move || "攻击";
    effectsNow = MS.effectsOf(ID);
    const out = [];
    if (problems.length) out.push(`<div class="bad">招式单有 ${problems.length} 处问题：\n${esc(problems.slice(0, 8).join("\n"))}</div>`);
    if (!sheet) { el.innerHTML = out.join("") + `<p class="note">这个角色还没有招式单。</p>`; return; }
    const chain = MS.bases(ID).map((b) => (S.archetypes[b]?.label || S.figures[b]?.name || b));
    out.push(`<h2>原型</h2><div class="chain">${esc(chain.length ? chain.join(" › ") : "无")}</div>`);
    if (sheet.note) out.push(`<p class="note">${esc(sheet.note)}</p>`);
    const tl = MS.timelineOf(ID);
    if (tl) {
      for (const [side, title] of [["before", "命中前"], ["after", "命中后"]]) {
        const ps = tl.phases.filter((p) => p.side === side); if (!ps.length) continue;
        out.push(`<h2>${title}</h2><div class="rows">` + ps.map((p) => `<div data-phase="${p.id}"><span class="k">${esc(p.label)}</span><span class="id">${p.id}${p.frame1 !== undefined && p.frame1 !== p.frame0 ? ` → 第 ${p.frame1} 帧` : ""}</span><span class="v">${Math.round(p.t1 - p.t0)} ms</span></div>`).join("") + `</div>`);
        if (side === "before") out.push(`<div class="sum">到命中共 ${Math.round(tl.lead)} ms${tl.dash ? ` · 最后 ${Math.round(tl.dash.t1 - tl.dash.t0)} ms ${word(tl.dash.kind)}` : ""}</div>`);
      }
      const A2 = sheet.attack || {}, extra = [];
      if (A2.dash?.reach !== undefined) extra.push(["落点距离", "dash.reach", `× ${A2.dash.reach}`]);
      if (A2.dash?.levitate !== undefined) extra.push(["浮空高度", "dash.levitate", `× ${A2.dash.levitate}`]);
      if (A2.hitstop) extra.push(["定帧（轻 / 中 / 重）", "hitstop", A2.hitstop.join(" / ") + " 帧"]);
      if (sheet.speed !== undefined) extra.push(["动作速度", "speed", `× ${sheet.speed}`]);
      if (extra.length) out.push(`<h2>其他</h2><div class="rows">` + extra.map(([k, id, v]) => `<div><span class="k">${k}</span><span class="id">${id}</span><span class="v">${v}</span></div>`).join("") + `</div>`);
    }
    const fx = sheet.fx;
    if (fx) {
      out.push(`<h2>特效</h2><div class="rows">` + ["palette", "size", "style"].filter((k) => fx[k] !== undefined).map((k) => `<div><span class="k">${KEYS[k]}</span><span class="id">${k}</span><span class="v">${k === "palette" ? esc(MS.LABELS.palette[fx[k]] || fx[k]) : esc(value(fx[k]))}</span></div>`).join("") + `</div>`);
      for (const g of Object.keys(MS.FX_GROUPS)) {
        const items = effectsNow.filter((e) => e.group === g); if (!items.length) continue;
        out.push(`<div class="fxg" data-g="${g}"><b>${MS.LABELS.group[g]}</b><div class="rows">` + items.map((e) => `<div><span class="k">${esc(e.label)}</span><span class="id">${g}.${e.key}</span><span class="v">${esc(value(e.value))}</span></div>`).join("") + `</div></div>`);
      }
    }
    out.push(`<h2>标记</h2><div id="marks"></div>`);
    el.innerHTML = out.join("");
    drawMarks();
  }

  // ------------------------------------------------------------------ marks: a moment, its numbers, a picture
  const marks = [];
  let wantShot = null;
  function shot(maxW = 720) {
    const w = Math.min(maxW, canvas.width), h = Math.round((w * canvas.height) / canvas.width), cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const g = cv.getContext("2d");
    g.drawImage(roomCanvas, 0, 0, w, h);
    const dm = +dimmer.style.opacity || 0; if (dm > 0.01) { g.fillStyle = `rgba(3,2,6,${0.8 * dm})`; g.fillRect(0, 0, w, h); }
    g.drawImage(canvas, 0, 0, w, h);
    return cv;
  }
  function describe(m) { return `[标记 ${m.n ?? "?"}] ${m.name}（${m.id}）· ${m.actLabel}${m.phase ? ` · ${m.phase.label}（${m.phase.id}）` : ""} · 第 ${m.realMs} ms${m.clipMs != null ? `（招式第 ${m.clipMs} ms${m.frame != null ? `，片段第 ${m.frame} 帧` : ""}）` : ""}${m.note ? ` — ${m.note}` : ""}`; }
  async function mark() {
    const r = reading(), sheet = MS.sheet(ID);
    const m = { id: ID, name: sheet?.name || ID, foe: FOE_ID, act: take.act, actLabel: ACTS[take.act].label, phase: r ? { id: r.frozen ? "hitstop" : r.phase.id, label: r.frozen ? "定帧" : r.phase.label } : null,
      realMs: Math.round(elapsed()), clipMs: r ? Math.round(r.nominal) : null, frame: r?.frame != null ? +r.frame.toFixed(1) : null, view: viewName, cam: { yaw: +view.yaw.toFixed(1), pitch: +view.pitch.toFixed(1), dist: +view.dist.toFixed(2) },
      rev: REV || "current", time: new Date().toISOString(), note: "" };
    clock.paused = true; syncButtons();
    const png = await new Promise((res) => { wantShot = (cv) => res(cv.toDataURL("image/jpeg", 0.86)); });
    m.thumb = png;
    try { const res = await fetch("/__review/mark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...m, thumb: undefined, png }) }); m.n = (await res.json()).n; }
    catch { m.n = marks.length + 1; m.local = true; }
    marks.unshift(m);
    if (!document.querySelector("#app.sheet")) toggleSheet(true);
    drawMarks();
    toast(`已标记 ${m.n}：${m.phase ? m.phase.label + " · " : ""}第 ${m.realMs} ms` + (m.local ? "（未连上审片服务，只留在本页）" : ""));
    return m;
  }
  function drawMarks() {
    const el = $("#marks"); if (!el) return;
    el.innerHTML = marks.length ? marks.map((m, i) => `<div class="mark" data-i="${i}"><img src="${m.thumb}" alt="标记 ${m.n}" title="回到这一刻"><div><div class="what"><b>标记 ${m.n}</b> · ${esc(m.name)} · ${esc(m.actLabel)}${m.phase ? " · " + esc(m.phase.label) : ""} · ${m.realMs} ms</div><input type="text" placeholder="想怎么改？（可不填，直接口述）" value="${esc(m.note)}"><button class="copy" type="button">复制这条标记</button></div></div>`).join("")
      : `<p class="note">暂停在想说的那一刻，点「标记这一刻」。之后只要说“看标记 3”。</p>`;
  }
  $("#sheet").addEventListener("click", (e) => {
    const row = e.target.closest(".mark"); if (!row) return;
    const m = marks[+row.dataset.i];
    if (e.target.closest(".copy")) { navigator.clipboard?.writeText(describe(m)).then(() => toast("已复制"), () => toast("复制失败", true)); return; }
    if (e.target.tagName === "IMG") { (m.id !== ID ? choose(m.id) : Promise.resolve()).then(() => play(m.act, m.realMs)); }
  });
  $("#sheet").addEventListener("change", (e) => {
    const row = e.target.closest(".mark"); if (!row || e.target.tagName !== "INPUT") return;
    const m = marks[+row.dataset.i]; m.note = e.target.value;
    fetch("/__review/mark/note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n: m.n, note: m.note }) }).catch(() => {});
  });

  // ------------------------------------------------------------------ notes: what the reviewer says of each act
  /* One note per act of each figure (and one for the figure as a whole): a verdict (满意 / 要改), a few words, and — when
   * asked — the moment the take was paused on. Saved as it is written (tools/move-review/notes.json); Claude reads
   * them (tools/move-review/notes.py), changes the sheets, and answers under the note. */
  const NOTE_ACTS = [["general", "整体"], ["attack", "攻击"], ["heavy", "重击"], ["kill", "致命一击"], ["hurt", "受击"], ["hurt3", "重创"], ["die", "阵亡"], ["victory", "胜利"], ["enter", "登场"], ["idle", "待机"]];
  const noteLabel = Object.fromEntries(NOTE_ACTS);
  let allNotes = {}, noteAct = "attack", noteDirty = false, noteTimer = 0, notesStamp = null;
  const noteOf = (fig = ID, act = noteAct) => allNotes[fig]?.[act] || null;
  function drawNote() {
    if (EMBED) return;
    const n = noteOf(), mine = allNotes[ID] || {};
    $("#note h2").textContent = `你对「${MS.sheet(ID)?.name || ID}」的意见`;
    $("#note-acts").innerHTML = NOTE_ACTS.map(([a, l]) => { const m = mine[a]; return `<button type="button" data-note-act="${a}" aria-pressed="${a === noteAct}" class="${m ? "has" : ""}${m?.status === "done" ? " done" : m?.verdict === "ok" ? " ok" : ""}">${l}</button>`; }).join("");
    for (const b of $$("[data-verdict]")) b.setAttribute("aria-pressed", String(n?.verdict === b.dataset.verdict));
    const ta = $("#note-text");
    if (document.activeElement !== ta || !noteDirty) ta.value = n?.text || "";
    $("#note-at").checked = false;
    const rp = $("#note-reply");
    rp.hidden = !n?.reply; if (n?.reply) rp.innerHTML = `<b>Claude${n.status === "done" ? "（已处理）" : "（上次的回复）"}：</b>${esc(n.reply)}`;
    $("#note-state").textContent = n?.time ? `已保存 ${n.time.slice(5, 16)}` : "";
    const open = Object.values(allNotes).reduce((k, acts) => k + Object.values(acts).filter((x) => x.status !== "done" && (x.text || x.verdict === "fix")).length, 0), total = Object.values(allNotes).reduce((k, acts) => k + Object.keys(acts).length, 0);
    $("#note-all").textContent = total ? `全部留言（${total} 条，${open} 条待处理）` : "全部留言";
    for (const b of $$("[data-who]")) { const acts = Object.values(allNotes[b.dataset.who] || {}); b.classList.toggle("noted", acts.length > 0); b.classList.toggle("okd", acts.length > 0 && acts.every((x) => x.verdict === "ok")); b.classList.toggle("answered", acts.length > 0 && acts.every((x) => x.status === "done")); }
  }
  async function saveNote() {
    clearTimeout(noteTimer);
    if (!noteDirty) return;
    noteDirty = false;
    const fig = ID, act = noteAct, text = $("#note-text").value, verdict = $("#note-verdict [aria-pressed=true]")?.dataset.verdict || "";
    const r = reading(), at = $("#note-at").checked ? { act: take.act, ms: Math.round(elapsed()), phase: r ? (r.frozen ? "定帧" : r.phase.label) : null } : undefined;
    try {
      const res = await fetch("/__review/note", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ figure: fig, name: MS.sheet(fig)?.name || fig, act, text, verdict, at }) });
      const entry = await res.json();
      if (entry.text !== undefined || entry.verdict) (allNotes[fig] ||= {})[act] = entry; else if (allNotes[fig]) { delete allNotes[fig][act]; if (!Object.keys(allNotes[fig]).length) delete allNotes[fig]; }
      if (fig === ID && act === noteAct) $("#note-state").textContent = entry.time ? `已保存 ${entry.time.slice(5, 16)}` : "已清除";
      drawNote();
    } catch { noteDirty = true; $("#note-state").textContent = "没存上：审片服务没连上"; }
  }
  /** show the note of another act (what was being written is saved first) */
  function showNote(act) { if (noteDirty) saveNote(); noteAct = act; drawNote(); }
  const touchNote = () => { noteDirty = true; $("#note-state").textContent = "…"; clearTimeout(noteTimer); noteTimer = setTimeout(saveNote, 1200); };
  async function loadNotes() { try { allNotes = await (await fetch("/__review/notes", { cache: "no-store" })).json(); } catch {} drawNote(); }
  if (!EMBED) {
    $("#note-text").addEventListener("input", touchNote);
    $("#note-text").addEventListener("blur", saveNote);
    $("#note-at").addEventListener("change", touchNote);
    $("#note-verdict").addEventListener("click", (e) => { const b = e.target.closest("[data-verdict]"); if (!b) return; const on = b.getAttribute("aria-pressed") !== "true"; for (const x of $$("[data-verdict]")) x.setAttribute("aria-pressed", String(on && x === b)); noteDirty = true; saveNote(); });
    $("#note-acts").addEventListener("click", (e) => { const b = e.target.closest("[data-note-act]"); if (!b) return; const a = b.dataset.noteAct; showNote(a); if (a !== "general" && a !== take.act && ACTS[a]) play(a); });
    $("#note-all").addEventListener("click", () => {
      const rows = Object.entries(allNotes).flatMap(([fig, acts]) => Object.entries(acts).map(([act, n]) => ({ fig, act, n }))).sort((a, b) => (b.n.time || "").localeCompare(a.n.time || ""));
      $("#notes-pop").innerHTML = rows.length ? rows.map(({ fig, act, n }) => `<button type="button" class="nrow" data-fig="${fig}" data-nact="${act}"><span class="st ${n.status === "done" ? "" : "open"}">${n.status === "done" ? "已处理" : n.verdict === "ok" && !n.text ? "满意" : "待处理"}</span><span class="who2">${esc(n.name || fig)}</span> · ${noteLabel[act] || act}${n.verdict ? ` · ${n.verdict === "ok" ? "满意" : "要改"}` : ""}${n.at?.ms != null ? ` · 第 ${n.at.ms} ms` : ""}<span class="tx">${esc(n.text || "")}</span>${n.reply ? `<span class="rp">Claude：${esc(n.reply)}</span>` : ""}</button>`).join("")
        : `<p class="note">还没有留言。在右侧“你的意见”里对每个动作写下想法即可，写完自动保存。</p>`;
      openPop($("#notes-pop"));
    });
    $("#notes-pop").addEventListener("click", async (e) => {
      const b = e.target.closest(".nrow"); if (!b) return;
      const { fig, nact } = b.dataset, n = allNotes[fig]?.[nact];
      openPop(null);
      if (fig !== ID) await choose(fig);
      noteAct = nact; drawNote();
      if (nact !== "general" && ACTS[nact]) await play(nact, n?.at?.act === nact ? n.at.ms : null);        // (back on the moment it was written on)
    });
  }

  // ------------------------------------------------------------------ the sheets, read again when they are saved
  const KNOWN = { clips: typeof EmberModelAnims !== "undefined" ? Object.fromEntries(Object.entries(EmberModelAnims).map(([k, v]) => [k, v.n])) : undefined, palettes: EmberSkillFx.PAL };
  let sheetsHash = null, revs = [];
  problems = MS.validate(MS.sheets, KNOWN);
  async function reloadSheets() {
    const text = await (await fetch(`/src/content/moves.js?t=${Date.now()}`, { cache: "no-store" })).text();
    let S;
    try { S = new Function(text.replace(/\nif \(typeof module[^\n]*/, "") + "\nreturn EmberMoveSheets;")(); }
    catch (e) { problems = ["读不了 content/moves.js：" + e.message]; drawSheet(); toast("招式单有语法错误，仍在播放上一版", true); return; }
    try { MS.use(S); MF.reload(); problems = MS.validate(S, KNOWN); }
    catch (e) { problems = [String(e.message || e)]; drawSheet(); toast("招式单有错，见右侧", true); return; }
    drawSheet();
    arena.dispose(); jobs.length = 0; arena = makeArena(); seed = SEED;              // the figures are built again from the new sheets
    const act = ACTS[take.act] ? take.act : "attack";
    await play(act === "idle" ? "attack" : act, null, { fresh: true });
    if (compareOn) loadBase();
    toast(problems.length ? `招式单已更新，但有 ${problems.length} 处问题` : "招式单已更新，重播中", problems.length > 0);
  }
  let codeStamp = 0;
  async function poll() {
    try {
      const s = await (await fetch("/__review/state", { cache: "no-store" })).json();
      revs = s.revisions || [];
      if (!EMBED && s.notes !== notesStamp && !noteDirty) { notesStamp = s.notes; await loadNotes(); }     // (Claude answered, or the first load)
      // (the engine or the clips changed under the page: load it all again, on the same figure and act)
      if (codeStamp && s.code && s.code !== codeStamp) { location.reload(); return; }
      codeStamp = s.code || codeStamp;
      if (sheetsHash && s.hash !== sheetsHash && !REV) { sheetsHash = s.hash; await reloadSheets(); }
      sheetsHash = s.hash;
    } catch {}
  }
  if (!EMBED) setInterval(poll, 700);

  // ------------------------------------------------------------------ the version before, beside this one
  const base = $("#base");
  let compareOn = false, baseReady = false;
  function tell(msg) { if (compareOn && baseReady && !EMBED) base.contentWindow?.postMessage({ review: true, ...msg }, location.origin); }
  let camTold = 0;
  function tellCam() { const r = real(); if (r - camTold < 30) return; camTold = r; tell({ cmd: "cam", yaw: view.yaw, pitch: view.pitch, dist: view.dist, tx: view.tx, ty: view.ty, tz: view.tz }); }
  function loadBase() {
    baseReady = false;
    const sel = $("#rev"), cur = sheetsHash, older = revs.filter((r) => r.hash !== cur);
    sel.innerHTML = older.length ? older.slice().reverse().map((r, i) => `<option value="${r.n}">${i === 0 ? "上一版" : "更早"} · 第 ${r.n} 版 ${r.time.slice(11, 16)}</option>`).join("") : `<option value="">还没有更早的版本</option>`;
    base.src = `/?embed=1&rev=${older.length ? older[older.length - 1].n : "prev"}&who=${ID}&foe=${FOE_ID}&view=${viewName}`;
  }
  $("#rev").addEventListener("change", (e) => { baseReady = false; base.src = `/?embed=1&rev=${e.target.value}&who=${ID}&foe=${FOE_ID}&view=${viewName}`; });
  function setCompare(on) {
    compareOn = on; $("#app").classList.toggle("compare", on); $("#compare").setAttribute("aria-pressed", String(on));
    if (on) loadBase(); else { base.src = "about:blank"; baseReady = false; }
  }
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data?.review) return;
    const m = e.data;
    if (!EMBED) { if (m.cmd === "ready") { baseReady = true; tell({ cmd: "cam", ...view, want: undefined }); tell({ cmd: "speed", speed: clock.speed }); tell({ cmd: "play", act: take.act, toMs: clock.paused ? elapsed() : null, who: ID, foe: FOE_ID }); } return; }
    if (m.cmd === "play") { (m.who !== ID || m.foe !== FOE_ID ? choose(m.who, m.foe, true) : Promise.resolve()).then(() => play(m.act, m.toMs, { told: true })); }
    else if (m.cmd === "pause") { clock.paused = m.paused; }
    else if (m.cmd === "step") ff(STEP);
    else if (m.cmd === "speed") clock.speed = m.speed;
    else if (m.cmd === "view") setView(m.name);
    else if (m.cmd === "cam") { view.want = null; for (const k of ["yaw", "pitch", "dist", "tx", "ty", "tz"]) if (typeof m[k] === "number") view[k] = m[k]; }
  });

  // ------------------------------------------------------------------ controls
  let toastT = 0;
  function toast(text, bad = false) { const el = $("#toast"); el.textContent = text; el.classList.toggle("bad", bad); el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 2600); }
  function syncButtons() {
    if (EMBED) return;
    $("#toggle").firstChild.textContent = clock.paused ? "播放" : "暂停";
    $("#loop").setAttribute("aria-pressed", String(clock.loop));
    for (const b of $$("[data-act]")) b.setAttribute("aria-pressed", String(b.dataset.act === take.act));
    if (ACTS[take.act] && noteAct !== "general" && noteAct !== take.act) showNote(take.act);     // the note follows what plays
  }
  const DO = {
    replay: () => play(take.act),
    toggle: () => { if (clock.busy) return; if (clock.paused && elapsed() >= take.L.total) return play(take.act); clock.paused = !clock.paused; syncButtons(); tell({ cmd: "pause", paused: clock.paused }); },
    fwd: () => { if (clock.busy) return; clock.paused = true; ff(STEP); syncButtons(); tell({ cmd: "play", act: take.act, toMs: elapsed(), who: ID, foe: FOE_ID }); },
    back: () => { if (clock.busy) return; seek(elapsed() - STEP); },
    loop: () => { clock.loop = !clock.loop; syncButtons(); },
    mark: () => mark(),
  };
  $("#bar").addEventListener("click", (e) => {
    const b = e.target.closest("[data-do], [data-act], [data-speed]"); if (!b) return;
    if (b.dataset.do) DO[b.dataset.do]();
    else if (b.dataset.act) play(b.dataset.act);
    else { clock.speed = +b.dataset.speed; for (const x of $$("[data-speed]")) x.setAttribute("aria-pressed", String(x === b)); tell({ cmd: "speed", speed: clock.speed }); }
  });
  addEventListener("keydown", (e) => {
    if (EMBED || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey) return;
    const k = e.key;
    if (k === " ") { e.preventDefault(); DO.toggle(); } else if (k === "ArrowRight") { e.preventDefault(); DO.fwd(); } else if (k === "ArrowLeft") { e.preventDefault(); DO.back(); }
    else if (k === "r" || k === "R") DO.replay(); else if (k === "m" || k === "M") DO.mark(); else if (k === "Escape") openPop(null);
  });
  const pick = (sel, attr, fn) => $(sel)?.addEventListener("click", (e) => {
    const b = e.target.closest(`[data-${attr}]`); if (!b) return;
    for (const x of $(sel).querySelectorAll("button")) x.setAttribute("aria-pressed", String(x === b));
    fn(b.dataset[attr]);
  });
  for (const b of $$("[data-view]")) b.addEventListener("click", () => setView(b.dataset.view));
  pick("#spin", "spin", (v) => { view.spin = v === "1"; });
  pick("#sound", "sound", (v) => SFX.enable(v === "1"));
  pick("#foe", "foe", (v) => choose(ID, v));
  const pops = [[$("#pick"), $("#picker")], [$("#gear"), $("#panel")], [$("#note-all"), $("#notes-pop")]];
  function openPop(which) { pops.forEach(([btn, pop]) => { const on = pop === which && pop.hidden; pop.hidden = !on; btn.setAttribute("aria-expanded", String(on)); }); }
  for (const [btn, pop] of pops.slice(0, 2)) btn.addEventListener("click", () => openPop(pop));
  function toggleSheet(on) { $("#app").classList.toggle("sheet", on); $("#sheet-btn").setAttribute("aria-pressed", String(on)); }
  $("#sheet-btn").addEventListener("click", () => toggleSheet(!$("#app").classList.contains("sheet")));
  $("#compare").addEventListener("click", () => setCompare(!compareOn));

  // the picker: every figure with a sheet and a model, by its class
  function drawPicker() {
    const S = MS.sheets, have = (id) => typeof EmberModelArt !== "undefined" && !!EmberModelArt[id], groups = new Map();
    for (const id of Object.keys(S.figures)) {
      const chain = MS.bases(id), root = chain.filter((b) => S.archetypes[b]).pop() || "other";
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(id);
    }
    $("#picker").innerHTML = [...groups].map(([g, ids]) => `<div class="group"><div class="role">${esc(S.archetypes[g]?.label || "其他")}</div><div class="who">` +
      ids.map((id) => `<button type="button" data-who="${id}" aria-pressed="${id === ID}"${have(id) ? "" : ' disabled title="还没有写实模型"'}>${esc(MS.sheet(id)?.name || id)}</button>`).join("") + `</div></div>`).join("");
  }
  $("#picker").addEventListener("click", (e) => { const b = e.target.closest("[data-who]"); if (b && !b.disabled && b.dataset.who !== ID) choose(b.dataset.who); });
  async function choose(id, foe = FOE_ID, told = false) {
    ID = id; FOE_ID = foe === id ? (id === "squire" ? "recruit" : "squire") : foe;
    openPop(null);
    for (const b of $$("[data-who]")) b.setAttribute("aria-pressed", String(b.dataset.who === id));
    if (!EMBED) history.replaceState(null, "", `?who=${ID}${FOE_ID !== "squire" ? `&foe=${FOE_ID}` : ""}`);
    arena.dispose(); jobs.length = 0; arena = makeArena();
    if (!EMBED) { if (noteDirty) saveNote(); noteAct = "attack"; }
    drawSheet(); drawNote();
    seed = SEED;                                       // the figures are built on the same dice every time (their idle phase, their blinks)
    await play("attack", null, { fresh: true, told });
    if (!told && compareOn) loadBase();
  }

  // ------------------------------------------------------------------ frames
  let lastReal = real(), heldAt = "";
  function draw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w && h && (roomCanvas.width !== Math.round(w * dpr()) || roomCanvas.height !== Math.round(h * dpr()))) {
      for (const r of [roomRenderer, renderer]) { r.setPixelRatio(dpr()); r.setSize(w, h, false); }
      cam.aspect = w / Math.max(1, h); cam.updateProjectionMatrix();
    }
    const pn = arena.punch(vt), dm = arena.dim(vt);
    if (pn > 1e-4) { const d0 = view.dist; view.dist = d0 * (1 - pn); placeCam(); view.dist = d0; } else placeCam();
    dimmer.style.opacity = dm.toFixed(3);
    const sh = arena.shake(vt);
    if (sh > 1e-4) { cam.position.x += sh * Math.sin(vt * 0.093); cam.position.y += sh * 0.8 * Math.cos(vt * 0.121); }
    arena.each((u) => {
      let s = shadows.get(u.k);
      if (!s) { s = new THREE.Mesh(new THREE.CircleGeometry(1, 32), shadowMat); s.rotation.x = -Math.PI / 2; room.add(s); shadows.set(u.k, s); }
      const p = POS.get(u.k); s.position.set(p.x, 0.004, p.z); s.scale.setScalar(0.42);
    });
    roomRenderer.render(room, cam);
    pass.render(scene, cam, [EmberSpriteFigures.LAYER, 2]);
  }
  function frame() {
    requestAnimationFrame(frame);
    const r = real(), dt = Math.min(50, r - lastReal); lastReal = r;
    if (!clock.busy) {
      if (!clock.paused) {
        tick(dt * clock.speed);
        if (take.L && elapsed() >= take.L.total && !EMBED) { if (clock.loop && take.act !== "idle") play(take.act); else if (take.act !== "idle") { clock.paused = true; syncButtons(); } }
      } else {                                           // held: the same pose; its lights turn with the camera when it moves
        const at = `${view.yaw.toFixed(2)},${view.pitch.toFixed(2)},${view.dist.toFixed(3)}`;
        if (at !== heldAt) { heldAt = at; arena.step(vt, cam, 0); }
      }
    }
    if (view.want) {
      const k = 1 - Math.exp((-dt / 1000) * 5);
      for (const key of ["yaw", "pitch", "dist", "tx", "ty", "tz"]) view[key] += (view.want[key] - view[key]) * k;
      if (Math.abs(view.want.dist - view.dist) < 0.01 && Math.abs(view.want.yaw - view.yaw) < 0.05) view.want = null;
    }
    if (view.spin && !drag) { view.yaw += (dt / 1000) * 14; tellCam(); }
    draw();
    if (wantShot) { const fn = wantShot; wantShot = null; fn(shot()); }
    hud();
  }

  // ------------------------------------------------------------------ start
  cam.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  if (!EMBED) { toggleSheet(true); drawPicker(); drawSheet(); drawNote(); setView(viewName, true); }     // (the panel is where the reviewer writes: open from the start)
  else setView(viewName, true);
  (async function start() {
    while (!MF.has(ID) && typeof EmberModelArt !== "undefined" && EmberModelArt[ID]) await sleep(50);
    while (!MF.has(FOE_ID) && typeof EmberModelArt !== "undefined" && EmberModelArt[FOE_ID]) await sleep(50);
    await poll();
    await play(Q.get("act") && ACTS[Q.get("act")] ? Q.get("act") : "attack", null, { fresh: true, told: true });
    if (EMBED) parent.postMessage({ review: true, cmd: "ready" }, location.origin);
  })();
  requestAnimationFrame(frame);

  // ------------------------------------------------------------------ the audit: every act measured, its key moments on a sheet
  /* audit(id) plays the figure's acts frame by frame — its attack, its heavy blow, being hit, its triumph, standing at
   * rest — and reports what a reviewer would otherwise have to catch by eye: the weapon that stops short of its foe, a
   * foot or a hand through the floor, a pose that pops between two frames, the weapon or a hand passing through its
   * own body, two bodies standing in one another, a blow whose light burns the picture white — with a sheet of the
   * key moments (and of the worst frame of whatever it flags). Sizes are × the figure's height; a "depth" is how far
   * into a body part something reaches, as a share of that part's radius (1 = to its middle).
   * The body is measured as capsules round its bones, their radii taken from the model's own skin: a guide to where
   * to look, not a verdict. */
  // (where a number turns into a warning: set so that what the 70 figures did on 2026-10-02 — the look approved so far
  // — passes and only its outliers are named; to be moved as the reviews say what is too much)
  const LIMIT = { reach: 0.9, facing: 35, sink: 0.06, pop: 120, jump: 0.45, white: 0.27, extent: 2.9, landing: 0.4, near: 0.25, weapon: 0.82, hand: 0.8, bodies: 0.55, through: 0.22, under: 0.035, tipUnder: 0.08 };
  const segPoint = (p, a, b) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / Math.max(1e-9, ab.lengthSq()))); return p.distanceTo(a.clone().addScaledVector(ab, t)); };
  /** the least distance between two segments (sampled: fine enough at these sizes) */
  function segSeg(a0, a1, b0, b1) { let d = Infinity; for (let i = 0; i <= 8; i++) d = Math.min(d, segPoint(a0.clone().lerp(a1, i / 8), b0, b1)); for (let i = 0; i <= 8; i++) d = Math.min(d, segPoint(b0.clone().lerp(b1, i / 8), a0, a1)); return d; }
  const BODY = [["Hips", "Spine"], ["Spine", "Spine1"], ["Spine1", "Spine2"], ["Spine2", "Neck"], ["LeftArm", "LeftForeArm"], ["LeftForeArm", "LeftHand"], ["RightArm", "RightForeArm"], ["RightForeArm", "RightHand"],
    ["LeftUpLeg", "LeftLeg"], ["LeftLeg", "LeftFoot"], ["RightUpLeg", "RightLeg"], ["RightLeg", "RightFoot"]];
  const PART = { Hips: "胯", Spine: "腰", Spine1: "腹", Spine2: "胸", Head: "头", LeftArm: "左上臂", LeftForeArm: "左前臂", RightArm: "右上臂", RightForeArm: "右前臂", LeftUpLeg: "左大腿", LeftLeg: "左小腿", RightUpLeg: "右大腿", RightLeg: "右小腿",
    LeftHand: "左手", RightHand: "右手" };
  /** a humanoid model's body as capsules round its bones (bind space): each radius is where the nearest 30% of the
   *  bone's own skin lies within — the limb itself; a coat, a skirt, the armour's flares and a cloak's hem stay
   *  outside (a bow held before a coat is not through the leg); held metal is not body */
  function capsules(fig) {
    const M = fig.M;
    if (!M || M.beast || !fig.bones?.Hips || !fig.mesh) return null;
    if (M.caps) return M.caps;
    const geo = fig.mesh.geometry, P = geo.attributes.position.array, J = geo.attributes.skinIndex.array, W = geo.attributes.skinWeight.array, mt = geo.attributes.aMetal?.array;
    const idx = Object.fromEntries(M.joints.map((j, i) => [j.name, i]));
    const at = (name) => (idx[name] === undefined ? null : V3().setFromMatrixPosition(new THREE.Matrix4().fromArray(M.ibm, idx[name] * 16).invert()));
    const own = new Map();
    for (let v = 0; v < P.length / 3; v++) {
      if (mt && mt[v] >= 253) continue;
      let d = -1, w = -1; for (let k = 0; k < 4; k++) if (W[v * 4 + k] > w) { w = W[v * 4 + k]; d = J[v * 4 + k]; }
      if (!own.has(d)) own.set(d, []); own.get(d).push(V3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
    }
    const p60 = (ds) => (ds.length ? ds.sort((a, b) => a - b)[Math.floor(ds.length * 0.3)] : 0);
    const caps = [];
    for (const [a, b] of BODY) { const pa = at(a), pb = at(b); if (!pa || !pb || !fig.bones[a] || !fig.bones[b]) continue; const r = p60((own.get(idx[a]) || []).map((p) => segPoint(p, pa, pb))); if (r > 0) caps.push({ name: a, a, b, r }); }
    const hv = own.get(idx.Head) || [];
    if (hv.length && fig.bones.Head) { const c = hv.reduce((s, p) => s.add(p), V3()).multiplyScalar(1 / hv.length); caps.push({ name: "Head", a: "Head", off: c.clone().applyMatrix4(new THREE.Matrix4().fromArray(M.ibm, idx.Head * 16)), r: p60(hv.map((p) => p.distanceTo(c))) }); }
    return (M.caps = caps);
  }
  /** the capsules where the figure is now: [{ name, a, b, r }] in the world */
  function bodyNow(fig) {
    const caps = capsules(fig); if (!caps) return null;
    const k = fig.root.scale.x, wp = (b) => b.getWorldPosition(V3());
    return caps.map((c) => (c.off ? { name: c.name, a: fig.bones.Head.localToWorld(c.off.clone()), b: null, r: c.r * k } : { name: c.name, a: wp(fig.bones[c.a]), b: wp(fig.bones[c.b]), r: c.r * k }));
  }
  const TORSO = ["Hips", "Spine", "Spine1", "Spine2", "Head"], LEGS = ["LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg"];
  const depthSeg = (c, s0, s1) => 1 - (c.b ? segSeg(s0, s1, c.a, c.b) : segPoint(c.a, s0, s1)) / c.r;
  const depthPoint = (c, p) => 1 - (c.b ? segPoint(p, c.a, c.b) : p.distanceTo(c.a)) / c.r;
  /** one act of the hero's, stepped through: what moved wrongly, what passed through what → numbers (each worst
   *  value with the moment it happened, ms into the take) */
  async function measure(act, ms) {
    await play(act, 0);
    const hero = unit(HERO), foe = unit(FOE), fig = hero.fig, k = fig.root.scale.x, bb = fig.mesh?.geometry?.boundingBox, tall = (bb ? bb.max.y - bb.min.y : 0.9) * k;
    const B = fig.bones && !Array.isArray(fig.bones) ? fig.bones : fig.J || {}, wp = (b) => b.getWorldPosition(V3());
    const feet = ["LeftToeBase", "RightToeBase", "LeftFoot", "RightFoot"].filter((n) => B[n]), footRest = feet.map((n) => wp(B[n]).y);
    // (fingers out: a fist closing turns them fast and nobody sees it; the hair and cape spring out: it swings by design)
    const tracked = (Array.isArray(fig.bones) ? fig.bones : Object.values(B)).filter((b) => b && b.isBone && !/(Thumb|Index|Middle|Ring|Pinky)\d|^Back$/.test(b.name));
    const prevQ = tracked.map((b) => b.getWorldQuaternion(new THREE.Quaternion())), q = new THREE.Quaternion(), prevRoot = fig.root.position.clone();
    const side = fig.weapon?.R ? "Right" : fig.weapon?.L ? "Left" : null, other = side === "Right" ? "Left" : "Right";
    const low = ["LeftHand", "RightHand", "Head", "LeftLeg", "RightLeg", "Hips", "LeftForeArm", "RightForeArm"].filter((n) => B[n]);
    // what lands the blow: the weapon's point, the limb of a kick or a punch, else the hand
    const tipOf = fig.blade ? fig.blade[1] : B[fig.sig?.fx?.limb?.[1]] || B[side ? side + "Hand" : "RightHand"] || null;
    const foeTall = foe?.fig ? ((foe.fig.mesh?.geometry?.boundingBox ? foe.fig.mesh.geometry.boundingBox.max.y - foe.fig.mesh.geometry.boundingBox.min.y : 0.9) * foe.fig.root.scale.x) : 1;
    const N = { tall, near: Infinity, nearAt: 0, popIs: "", sink: 0, pop: 0, popAt: 0, jump: 0, jumpAt: 0, weapon: 0, weaponAt: 0, weaponIn: "", hand: 0, handAt: 0, handIn: "", bodies: 0, bodiesAt: 0, under: 0, underAt: 0, underIs: "", tipUnder: 0, tipUnderAt: 0 };
    const gaps = [];                                  // [ms, the blow's point to the foe's body] frame by frame
    // a beast has no capsules: its own skin is sampled, to see how far its front runs through its foe
    const skin = !capsules(fig) && fig.mesh?.isSkinnedMesh && ACTS[act].mine && foe?.fig ? fig.mesh.geometry.attributes.position : null, sv = V3();
    N.through = 0; N.throughAt = 0;
    const worst = (key, v, extra) => { if (v > N[key]) { N[key] = v; N[key + "At"] = elapsed(); Object.assign(N, extra); } };
    for (let t = 0; t < ms; t += STEP) {
      ff(STEP);
      if (!hero.fig || hero.state !== "live") break;                       // (it fell: the rest is its death)
      feet.forEach((n, i) => { N.sink = Math.max(N.sink, (footRest[i] - wp(B[n]).y) / tall); });
      // (the frame the blow lands on is the blow: the strike's last, fastest part and the hit-stop taking hold)
      const landing = ACTS[act].mine && take.plan.contact && Math.abs(elapsed() - (take.plan.ranged ? take.plan.lift : take.plan.contact)) <= STEP + 1;
      tracked.forEach((b, i) => { b.getWorldQuaternion(q); if (!landing) worst("pop", (2 * Math.acos(Math.min(1, Math.abs(q.dot(prevQ[i])))) * 180) / Math.PI, { popIs: b.name }); prevQ[i].copy(q); });
      if (ACTS[act].mine && tipOf && foe?.fig && !skin) {
        // how close the blow's point comes to the foe's body (its surface, when it is measured; else its middle)
        const tp = wp(tipOf), fb = bodyNow(foe.fig), c0 = foe.fig.root.position;
        const gap = fb ? Math.min(...fb.filter((c) => TORSO.includes(c.name)).map((c) => (c.b ? segPoint(tp, c.a, c.b) : tp.distanceTo(c.a)) - c.r)) : Math.hypot(tp.x - c0.x, tp.z - c0.z) - 0.2 * foeTall;
        gaps.push([elapsed(), gap / foeTall, reading()?.frame ?? null]);
        if (gap / foeTall < N.near) { N.near = gap / foeTall; N.nearAt = elapsed(); }
      }
      worst("jump", fig.root.position.distanceTo(prevRoot) / tall); prevRoot.copy(fig.root.position);
      for (const n of low) worst("under", -wp(B[n]).y / tall, { underIs: n });
      if (skin && take.plan.contact && !take.plan.ranged && !fig.stay && elapsed() >= take.plan.contact - 20 && elapsed() <= take.plan.contact + 300) {
        const fb = bodyNow(foe.fig), root = fig.root.position, dir = foe.fig.root.position.clone().sub(root).setY(0), dist = dir.length(); dir.normalize();
        const foeR = fb ? Math.max(...fb.filter((c) => c.b && TORSO.includes(c.name)).map((c) => c.r)) : 0.14 * foe.fig.root.scale.x;
        fig.root.updateMatrixWorld(true);
        let fw = -9;
        for (let i = 0, n = skin.count, st = Math.max(1, Math.floor(n / 700)); i < n; i += st) { fig.mesh.applyBoneTransform(i, sv.fromBufferAttribute(skin, i)).applyMatrix4(fig.mesh.matrixWorld); fw = Math.max(fw, (sv.x - root.x) * dir.x + (sv.z - root.z) * dir.z); }
        const g = (dist - foeR - fw) / foeTall;                       // its front to the foe's near side (negative: inside it)
        worst("through", -g);
        gaps.push([elapsed(), g, null]);
        if (g < N.near) { N.near = g; N.nearAt = elapsed(); }
      }
      const body = bodyNow(fig);
      if (body) {
        if (fig.blade) {
          const s0 = wp(fig.blade[0]), s1 = wp(fig.blade[1]);
          worst("tipUnder", -Math.min(s0.y, s1.y) / tall);
          // (a thing carried at the side hangs against a robe or a coat: against a leg only a deep cut counts)
          if (!fig.suite?.bow) for (const c of body) if (TORSO.includes(c.name) || LEGS.includes(c.name) || c.name === other + "Arm" || c.name === other + "ForeArm") worst("weapon", depthSeg(c, s0, s1) - (LEGS.includes(c.name) ? 0.18 : 0), { weaponIn: c.name });
        }
        for (const h of ["LeftHand", "RightHand"]) if (B[h]) { const p = wp(B[h]); for (const c of body) if (TORSO.includes(c.name)) worst("hand", depthPoint(c, p), { handIn: `${h}>${c.name}` }); }
        const theirs = foe?.fig && foe.state === "live" ? bodyNow(foe.fig) : null;
        if (theirs) for (const c of body) if (TORSO.includes(c.name)) for (const d of theirs) if (TORSO.includes(d.name)) {
          const gap = c.b && d.b ? segSeg(c.a, c.b, d.a, d.b) : c.b ? segPoint(d.a, c.a, c.b) : d.b ? segPoint(c.a, d.a, d.b) : c.a.distanceTo(d.a);
          worst("bodies", 1 - gap / (c.r + d.r));
        }
      }
    }
    if (N.near === Infinity) delete N.near;
    // when the blow arrives: the first frame its point is as good as at its closest (the follow-through may press closer)
    // (touching the foe's surface counts as arrived, however much deeper the follow-through then presses)
    else { const hit = gaps.find(([, g]) => g <= Math.max(N.near + 0.06, 0.02)) || [N.nearAt, N.near, null]; N.arriveAt = hit[0]; if (hit[2] != null) N.arriveFrame = hit[2]; N.gaps = gaps.map(([t, g, f]) => [Math.round(t), +g.toFixed(3), f == null ? null : +f.toFixed(2)]); }
    for (const key of Object.keys(N)) if (typeof N[key] === "number") N[key] = +N[key].toFixed(key.endsWith("At") ? 0 : 3);
    N.hitstop = hero.fig?.sig?.hitstop || null;
    return N;
  }
  const say = (n) => PART[n] || n;
  /** the checks every act shares → pushed onto `checks` as { ok, act, text, at } */
  function judge(act, N, checks, feetOnGround) {
    const L = ACTS[act].label, add = (key, ok, text, at) => checks.push({ key: `${act}.${key}`, ok, act, text: `${L}：${text}`, at });
    add("pop", N.pop <= LIMIT.pop, `相邻两帧骨骼最大转动 ${N.pop.toFixed(1)}°（${N.popIs}，第 ${N.popAt} ms）` + (N.pop > LIMIT.pop ? "：动作跳变" : ""), N.popAt);
    add("jump", N.jump <= LIMIT.jump, `相邻两帧位移最大 ${N.jump} 个身高（第 ${N.jumpAt} ms）` + (N.jump > LIMIT.jump ? "：瞬移" : ""), N.jumpAt);
    if (feetOnGround) add("sink", N.sink <= LIMIT.sink, `脚最多沉入地面 ${(N.sink * 100).toFixed(0)}% 身高` + (N.sink > LIMIT.sink ? "：穿地" : ""));
    if (N.under > 0) add("under", N.under <= LIMIT.under, `${say(N.underIs)}最低到地面下 ${(N.under * 100).toFixed(0)}% 身高（第 ${N.underAt} ms）` + (N.under > LIMIT.under ? "：穿地" : ""), N.underAt);
    if (N.tipUnder > 0) add("tipUnder", N.tipUnder <= LIMIT.tipUnder, `武器最低到地面下 ${(N.tipUnder * 100).toFixed(0)}% 身高（第 ${N.tipUnderAt} ms）` + (N.tipUnder > LIMIT.tipUnder ? "：插进地面" : ""), N.tipUnderAt);
    if (N.weaponIn) add("weapon", N.weapon <= LIMIT.weapon, `武器最深穿入自己的${say(N.weaponIn)} ${(N.weapon * 100).toFixed(0)}%（第 ${N.weaponAt} ms）` + (N.weapon > LIMIT.weapon ? "：穿模" : ""), N.weaponAt);
    if (N.handIn) { const [h, c] = N.handIn.split(">"); add("hand", N.hand <= LIMIT.hand, `${say(h)}最深进入${say(c)} ${(N.hand * 100).toFixed(0)}%（第 ${N.handAt} ms）` + (N.hand > LIMIT.hand ? "：穿模" : ""), N.handAt); }
    if (N.through > 0) add("through", N.through <= LIMIT.through, `身体最前端越过对手近侧 ${N.through.toFixed(2)} 个身高（第 ${N.throughAt} ms）` + (N.through > LIMIT.through ? "：穿过了对手的身体" : ""), N.throughAt);
    if (N.bodies > 0) add("bodies", N.bodies <= LIMIT.bodies, `与对手身体最多重叠 ${(N.bodies * 100).toFixed(0)}%（第 ${N.bodiesAt} ms）` + (N.bodies > LIMIT.bodies ? "：两人站进了一起" : ""), N.bodiesAt);
  }
  async function audit(id = ID, o = {}) {
    await choose(id);                                  // built afresh: the same take whatever was played before
    setView("front", true);
    const was = { loop: clock.loop }; clock.loop = false;
    const sheet = MS.sheet(id), checks = [], numbers = {}, cells = [];
    const cell = async (act, ms, label, viewName2 = "front") => { setView(viewName2, true); await play(act, ms); draw(); cells.push({ cv: shot(640), label: `${label} · 第 ${Math.round(ms)} ms${viewName2 === "battle" ? " · 对局视角" : ""}` }); setView("front", true); };

    // ---- the attack: the frame-by-frame numbers, then the blow itself
    await play("attack", 0);
    const hero = unit(HERO), foe = unit(FOE), fig = hero.fig, L = take.L, plan = take.plan;
    const foeBB = foe.fig.mesh?.geometry?.boundingBox, foeTall = (foeBB ? foeBB.max.y - foeBB.min.y : 0.9) * foe.fig.root.scale.x;
    const foeAt = () => foe.fig.root.position.clone().add(V3(0, foeTall * 0.5, 0));
    const B = fig.bones && !Array.isArray(fig.bones) ? fig.bones : fig.J || {}, wp = (b) => b.getWorldPosition(V3());
    const handName = fig.sig?.fx?.limb?.[1] || fig.sig?.fx?.castHand || (fig.weapon?.R ? "RightHand" : fig.weapon?.L ? "LeftHand" : fig.side === "L" ? "LeftHand" : "RightHand"), hand = B[handName];
    const strike = plan.ranged ? plan.lift : plan.contact, end = L.segs.filter((s) => s.id !== "linger").pop().x1, grounded = !!B.LeftFoot && !sheet?.body?.hover && !sheet?.body?.float;
    const N = (numbers.attack = await measure("attack", end));
    Object.assign(N, { lead: Math.round(L.tl?.lead ?? plan.contact), contact: Math.round(plan.contact), total: Math.round(L.total) });
    // the hand that lands the blow: when it is fastest
    if (hand && !fig.stay && !plan.ranged) {
      await play("attack", 0);
      // (in the world: a dart-in with the blade held out and a flying kick land with the body's speed, not the arm's)
      const own = () => wp(hand);
      let prev = own(), peak = 0, peakAt = 0, landing = 0;
      for (let t = 0; t < strike + 40; t += STEP) { ff(STEP); const p = own(), v = p.distanceTo(prev) / N.tall / (STEP / 1000); if (v > peak) { peak = v; peakAt = elapsed(); } if (elapsed() >= strike - 130) landing = Math.max(landing, v); prev = p; }
      N.handPeak = +peak.toFixed(2); N.handPeakAt = Math.round(peakAt); N.handLanding = +landing.toFixed(2);
    }
    await play("attack", strike);
    const fwd = V3(0, 0, 1).applyQuaternion(fig.root.quaternion).setY(0).normalize(), to = foeAt().sub(fig.root.position).setY(0).normalize();
    N.facing = +((Math.acos(Math.min(1, Math.max(-1, fwd.dot(to)))) * 180) / Math.PI).toFixed(1);
    if (!plan.ranged && !fig.stay) { const tip = fig.blade ? wp(fig.blade[1]) : hand ? wp(hand) : null; if (tip) { const c = foeAt(); N.reach = +(Math.hypot(tip.x - c.x, tip.z - c.z) / foeTall).toFixed(2); } }
    // the blow's light, with the figures hidden so that only the effects are measured: how much of the foe is burnt
    // white at the flash's peak (it should be: a blow flashes) and 150 ms on (it should not be), and how far it reaches
    const light = async (ms) => {
      await play("attack", ms);
      const roots = [unit(HERO), unit(FOE)].map((u) => u.fig.root);
      roots.forEach((r) => { r.visible = false; }); draw();
      const cv = shot(560);
      roots.forEach((r) => { r.visible = true; }); draw();
      const g = cv.getContext("2d"), W = cv.width, Hh = cv.height, px = g.getImageData(0, 0, W, Hh).data;
      const c = foeAt().project(cam), top = foe.fig.root.position.clone().add(V3(0, foeTall, 0)).project(cam), base2 = foe.fig.root.position.clone().project(cam);
      const cx = (c.x * 0.5 + 0.5) * W, cy = (1 - (c.y * 0.5 + 0.5)) * Hh, hpx = Math.abs(top.y - base2.y) * 0.5 * Hh;
      const x0 = Math.max(0, Math.round(cx - hpx * 0.625)), x1 = Math.min(W, Math.round(cx + hpx * 0.625)), y0 = Math.max(0, Math.round(cy - hpx * 0.625)), y1 = Math.min(Hh, Math.round(cy + hpx * 0.625));
      let white = 0, n = 0, far = 0;
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4, hot = px[i] > 244 && px[i + 1] > 244 && px[i + 2] > 236, lit = Math.max(px[i], px[i + 1], px[i + 2]) > 150;
        if (x >= x0 && x < x1 && y >= y0 && y < y1) { n++; if (hot) white++; }
        if (lit) far = Math.max(far, Math.hypot(x - cx, y - cy) / hpx);
      }
      return { white: +(white / Math.max(1, n)).toFixed(3), far: +far.toFixed(2) };
    };
    { const pk = await light(plan.contact + 3 * STEP), af = await light(plan.contact + 150); N.whitePeak = pk.white; N.extent = pk.far; N.whiteAfter = af.white; }
    const add = (key, ok, text, at) => checks.push({ key: `attack.${key}`, ok, act: "attack", text: `攻击：${text}`, at });
    if (N.near !== undefined && !plan.ranged && !fig.stay) {
      add("near", N.near <= LIMIT.near, `武器最近离对手身体 ${N.near.toFixed(2)} 个身高（第 ${N.nearAt} ms）` + (N.near > LIMIT.near ? "：够不着，像空挥" : ""), N.nearAt);
      // while the hit-stop holds the blow: the weapon should be on its target then, not on its way or long past
      // (within two frames of it: a chop driven into the ground has passed through its foe on the frame before)
      const held = Math.min(...N.gaps.filter(([t]) => Math.abs(t - strike) <= 2 * STEP + 1).map(([, g]) => g), Infinity); N.held = held === Infinity ? N.near : held;
      add("held", N.held <= LIMIT.near, `命中前后两帧内武器离对手身体 ${N.held.toFixed(2)} 个身高` + (N.held > LIMIT.near ? "：闪光时刀不在对手身上" : ""), strike + STEP);
    }
    add("facing", N.facing <= LIMIT.facing, `命中时身体朝向偏离对手 ${N.facing}°` + (N.facing > LIMIT.facing ? "：没对准" : ""), strike);
    if (N.handPeak) { const share = N.handLanding / N.handPeak; add("landing", share >= LIMIT.landing, `出手的手在命中前的速度是全程最快时的 ${(share * 100).toFixed(0)}%（最快在第 ${N.handPeakAt} ms）` + (share < LIMIT.landing ? "：发力太早，命中时已经没速度" : ""), N.handPeakAt); }
    add("white", N.whiteAfter <= LIMIT.white, `命中闪光峰值盖住对手 ${(N.whitePeak * 100).toFixed(0)}%，150 ms 后还剩 ${(N.whiteAfter * 100).toFixed(0)}% 过曝成白` + (N.whiteAfter > LIMIT.white ? "：白光拖太久，看不清受击" : ""), plan.contact + 150);
    add("extent", N.extent <= LIMIT.extent, `命中特效的光最远到对手 ${N.extent} 个身高外` + (N.extent > LIMIT.extent ? "：范围过大" : ""), plan.contact + 50);
    judge("attack", N, checks, grounded);
    for (const p of problems.filter((x) => x.startsWith(id + ":"))) checks.push({ key: "sheet", ok: false, act: "attack", text: "招式单：" + p });
    // ---- the other acts: the heavy blow, being hit (lightly, heavily), the triumph, standing at rest
    const plans = { attack: plan };
    for (const [act, ms] of [["heavy", null], ["hurt", 1400], ["hurt3", 1600], ["victory", 2400], ["idle", 9000]]) {
      await choose(id);                                // (each act from a figure built afresh: what it shows can be played again alone)
      await play(act, 0);
      plans[act] = take.plan;
      const len = ms ?? take.L.segs.filter((s) => s.id !== "linger").pop().x1;
      judge(act, (numbers[act] = await measure(act, len)), checks, grounded && act !== "victory");
      if (act === "victory") {
        const h = unit(HERO), f = h.fig, V = f.sig?.fx?.victory || {};
        if (f.sig && f.blade && V.ray !== false && f.bones?.Head) {
          await play("victory", 900);
          const tipY = f.blade[1].getWorldPosition(V3()).y, headY = f.bones.Head.getWorldPosition(V3()).y;
          checks.push({ key: "victory.ray", ok: tipY > headY, act, text: `胜利：天光落在武器尖上，武器尖${tipY > headY ? "举过头顶" : "却垂在头部以下：光柱打在身侧"}`, at: 900 });
        }
      }
    }
    // ---- the sheet: the attack's key moments, the blow as the battle's camera sees it, the other acts, and the worst
    // frame of whatever was flagged
    const moments = [];
    if (L.tl) for (const s of L.segs.filter((x) => x.side === "before")) moments.push({ ms: s.x1 - STEP, label: s.label + "末" });
    moments.pop(); moments.push({ ms: strike, label: plan.ranged ? "出手" : "命中" });
    if (plan.ranged) moments.push({ ms: plan.contact, label: "命中" });
    moments.push({ ms: plan.contact + 80, label: "命中 +80" }, { ms: plan.contact + 320, label: "命中 +320" });
    const settle = L.segs.find((x) => x.id === "settle"); if (settle) moments.push({ ms: settle.x1, label: "定格末" });
    for (const m of moments) await cell("attack", m.ms, m.label);
    await cell("attack", strike, plan.ranged ? "出手" : "命中", "battle");
    await cell("attack", plan.contact + 80, "命中 +80", "battle");
    if (!plan.ranged) await cell("attack", plan.contact + 320, "命中 +320 · 俯视", "top");
    await cell("heavy", plans.heavy.contact + 80, "重击 命中 +80");
    await cell("idle", 1500, "待机"); await cell("idle", 1500, "待机", "battle");
    await cell("hurt", plans.hurt.contact + 100, "受击 +100"); await cell("hurt3", plans.hurt3.contact + 160, "重创 +160");
    await cell("victory", 900, "胜利");
    // what was looked at and accepted (accepted.json: { figure: { check key: why } }) is reported as seen
    let accepted = {};
    try { accepted = (await (await fetch("/tools/move-review/accepted.json", { cache: "no-store" })).json())[id] || {}; } catch {}
    for (const c of checks) if (!c.ok && accepted[c.key]) { c.seen = accepted[c.key]; }
    for (const c of checks.filter((x) => !x.ok && !x.seen && x.at != null)) await cell(c.act, c.at, "要看：" + c.text.replace(/（第 \d+ ms）/, "").slice(0, 26));
    // (each frame 640 wide: narrower than that a blow cannot be judged)
    const cw = 640, cols = 4, ch = cells[0].cv.height, rows = Math.ceil(cells.length / cols), strip = document.createElement("canvas");
    strip.width = cw * cols; strip.height = (ch + 30) * rows;
    const g = strip.getContext("2d"); g.fillStyle = "#0d0b09"; g.fillRect(0, 0, strip.width, strip.height);
    cells.forEach((c, i) => {
      const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + 30);
      g.drawImage(c.cv, x, y + 30); g.fillStyle = c.label.startsWith("要看") ? "#ffb0b8" : "#ffd39a"; g.font = "600 18px 'PingFang SC', sans-serif"; g.fillText(c.label, x + 10, y + 21);
    });
    clock.loop = was.loop;
    const out = { id, name: sheet?.name || id, kind: sheet?.kind, numbers, checks, failed: checks.filter((c) => !c.ok && !c.seen).length, cells: cells.map((c) => c.label) };
    try { await fetch("/__review/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...out, figure: id, png: strip.toDataURL(o.png ? "image/png" : "image/jpeg", 0.88) }) }); } catch {}
    play("attack");
    return out;
  }

  /** film(act, from, to, { n, view, w, name }) → a strip of n frames of the take between two moments, saved beside
   *  the audits (for looking at what a number points at) */
  async function film(act, from, to, o = {}) {
    const n = o.n || 8, w = o.w || 480, cells = [];
    setView(o.view || "front", true);
    for (let i = 0; i < n; i++) { const ms = from + ((to - from) * i) / Math.max(1, n - 1); await play(act, ms); draw(); cells.push([shot(w), Math.round(ms)]); }
    const cols = Math.min(o.cols || 4, n), ch = cells[0][0].height, rows = Math.ceil(n / cols), cv = document.createElement("canvas");
    cv.width = w * cols; cv.height = (ch + 24) * rows;
    const g = cv.getContext("2d"); g.fillStyle = "#0d0b09"; g.fillRect(0, 0, cv.width, cv.height);
    cells.forEach(([c, ms], i) => { const x = (i % cols) * w, y = Math.floor(i / cols) * (ch + 24); g.drawImage(c, x, y + 24); g.fillStyle = "#ffd39a"; g.font = "600 15px 'PingFang SC', sans-serif"; g.fillText(`${ACTS[act].label} · 第 ${ms} ms`, x + 8, y + 17); });
    const name = o.name || `${ID}-film-${act}-${Math.round(from)}`;
    try { await fetch("/__review/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: name, figure: ID, act, from, to, png: cv.toDataURL("image/jpeg", 0.9) }) }); } catch {}
    setView("front", true);
    return name;
  }

  /* what the audit and a debugging session drive: the same takes, held at any moment */
  window.Review = {
    get arena() { return arena; }, clock, ACTS, HERO, FOE, unit, play, seek, ff, elapsed, reading, layout: () => take.L, take: () => take, choose, mark, marks, setView, shot, draw, reloadSheets, audit, film, measure, capsules, bodyNow, LIMIT,
    get id() { return ID; }, get foe() { return FOE_ID; }, get problems() { return problems; }, cam, view, THREE, STEP,
  };
})();
