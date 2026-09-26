/* EmberMiniatures — the voxel battlefield (docs/design/MINIATURES.md): one transparent canvas over the board, one
 * renderer, scene and camera, and an EmberVoxelArena holding the figures. Every minion token whose card has a voxel
 * figure gets one standing on it: the figure's ground point is its token's (so the effect layer's recoils and
 * shakes carry it), the token's art dims to a backdrop while the figure stands, and the cues come from the effect
 * layer (attack · contact · death). A melee figure leaves its token for the attack and dashes to the target on the
 * director's timeline while the token stays home with its stats; a ranged figure shoots from its token and EmberFx2
 * flies the projectile. Figures are baked in a worker ahead of use (the cards in hand, the cards an action summons;
 * cached per figure), so a played card turns straight into its figure: its token lands as a dark backdrop and the
 * figure assembles on it. Rules state is never read beyond the DOM; any failure falls back to flat tokens. */
const EmberMiniatures = (() => {
  const THREE = EmberVesperThree, KIT = EmberVoxelKit;
  const SIZE = 1.25;            // board size of a figure (× its spec.scale): a miniature a head taller than its token
  let renderer = null, pass = null, scene = null, camera = null, canvas = null, arena = null, failed = false, raf = 0, last = 0, box = null, dimmer = null;
  const stats = { status: "idle", error: null, frameMs: 0 };
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("reduced-motion");
  const desk = matchMedia("(hover: hover) and (pointer: fine)");
  // (phones too: every figure stands on the board at every size, the models' textures halved there — EmberModelFigures)
  // ?figures=0 (tests, a fallback check): the battlefield without figures, as when WebGL fails or motion is reduced
  const off = typeof location !== "undefined" && new URLSearchParams(location.search).get("figures") === "0";
  const enabled = () => !failed && !off && !reduced();
  const TOKEN_W = 116;          // a desktop token's layout width: figures keep their size relative to their token
  /* A unit's station is its token box (the layout places tokens; they stay the click and focus targets): the figure
   * stands at FOOT of its height on a pedestal of PED × its width, its stats sit in front of the pedestal, and it may
   * rise at most RISE × the token's height above the token and be MAX_W × its width wide — so no figure reaches into
   * the other line, the top bar or its neighbours. Sizes are measured through the camera at the unit's own spot, so
   * the far line's figures are as large against their tokens as the near line's. */
  const FOOT = 0.6, PED = 0.4, RISE = 0.5, MAX_W = 1.3;
  // camera layers drawn over the pixel pass at full resolution: sprite figures, then the hit-feel (so a burst in front
  // of a sprite shows)
  const FX_LAYER = 2, OVER = [EmberSpriteFigures.LAYER, FX_LAYER];
  // and the one drawn under it at full resolution: the halos the units stand on
  const BASE_LAYER = 3, UNDER = [BASE_LAYER];
  const _a = new THREE.Vector3(), _b = new THREE.Vector3();
  // screen px per world unit at a ground point: across (x) and upright (y)
  function ppu(p) {
    const h = box?.h || 1, w = box?.w || 1;
    _a.copy(p).project(camera); _b.copy(p).add(new THREE.Vector3(1, 0, 0)).project(camera);
    const across = Math.hypot((_b.x - _a.x) * w / 2, (_b.y - _a.y) * h / 2);
    _b.copy(p).add(new THREE.Vector3(0, 1, 0)).project(camera);
    return { across, up: Math.abs(_b.y - _a.y) * h / 2 };
  }
  const battle = () => document.getElementById("battle");
  const specOf = (cid) => KIT.forCard(cid);
  // a phone draws the stage at 1.5× at most: the figures stay crisp, ~45% fewer pixels than 2× (EMBER perf, 2026-09-27)
  const coarse = matchMedia("(pointer: coarse)");
  const dpr = () => Math.min(devicePixelRatio || 1, coarse.matches ? 1.5 : 2);

  function init() {
    if (renderer || failed) return !!renderer;
    try {
      canvas = document.createElement("canvas");
      canvas.id = "miniature-stage";
      canvas.setAttribute("aria-hidden", "true");
      battle().appendChild(canvas);
      // a god's blow dims the board round it (under the figures and their effects, which stay bright)
      dimmer = document.createElement("div");
      dimmer.id = "miniature-dim"; dimmer.setAttribute("aria-hidden", "true");
      battle().appendChild(dimmer);
      // a pixel sprite layer: no antialiasing; the 3D figures draw at EmberPixelPass.PIX of the CSS size and are outlined
      // by the pass, the painted sprite figures (EmberSpriteFigures) and the hit-feel draw over them at full resolution
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;          // figures grade themselves (EmberVoxelRender)
      pass = EmberPixelPass.create(renderer, { up: true });
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail("WebGL context lost"); });
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(18, 1, 1, 200);
      arena = EmberVoxelArena.create(scene, {
        size: SIZE, pixelRatio: dpr, wake, fxLayer: FX_LAYER, baseLayer: BASE_LAYER,
        bake: (id) => EmberVoxelBaker.bake(id),                          // voxelize in a worker, off the main thread
        ready: () => typeof EmberFX === "undefined" || !EmberFX.busy,       // a page-thread bake waits for a quiet moment
        warm: (root) => {                                  // compile its programs in parallel (KHR_parallel_shader_compile)
          root.visible = true;
          try { return renderer.compileAsync(scene, camera); } finally { root.visible = false; }
        },
        scaleOf: (u) => (u.info.hero ? fitHero(u) : fit(u)),
        base: (u) => {
          const el = u.info.el; if (!el?.isConnected || !el.offsetWidth) return null;
          // a hero's dais is the scene's; the stage draws only its state ring round the hero's feet
          if (u.info.hero) { const q = EmberArena3D.seat?.(u.side), c = el.classList; return q ? { r: q.rx / (u.pos ? ppu(u.pos).across : 150), ring: true, tint: q.tint, state: { ready: c.contains("ready"), frozen: c.contains("frozen"), target: c.contains("valid-target") || c.contains("selected") } } : null; }
          const c = el.classList;
          return { r: (PED * el.offsetWidth) / (u.pos ? ppu(u.pos).across : 150), state: { ready: c.contains("ready"), taunt: c.contains("taunt"), frozen: c.contains("frozen"), shield: c.contains("shield"), target: c.contains("valid-target") } };
        },
        where: (ref) => {
          if (ref.uid === "hero" && box && arena?.has(ref.side, "hero")) { const q = seatOf(ref.side, box); if (q) return q; }
          const own = arena?.unit(ref.side, ref.uid)?.info.el, el = own?.isConnected ? own : refEl(ref);   // (no query per frame)
          return el && el.isConnected && box ? footOf(el, box) : null;
        },
        live: (u, on) => { const el = u.info.el; if (!el) return; if (u.info.hero) { el.classList.toggle("hero-dais", on); return; } el.classList.toggle("miniature-ready", on); if (!on) el.classList.remove("miniature-pending"); },
      });
      // the hit-feel's particle, star, beam and trail programs compile now, not on the first contact of the battle
      renderer.compileAsync(scene, camera).catch(() => {});
      stats.status = "ready";
      return true;
    } catch (error) { fail(error); return false; }
  }
  function fail(error) {
    failed = true; stats.status = "fallback"; stats.error = String(error?.message || error);
    cancelAnimationFrame(raf); raf = 0;
    clearTokens();
    try { arena?.dispose(); renderer?.dispose(); } catch {}
    arena = null; renderer = null; canvas?.remove(); canvas = null; dimmer?.remove(); dimmer = null;
    console.warn("Battle miniatures unavailable; using flat tokens.", stats.error);
  }

  // camera: looks down onto the board like the arena; one world unit ≈ 150 px at the board centre
  function fitCamera() {
    const b = battle(), w = b.clientWidth, h = b.clientHeight, d = dpr(), px = d;
    if (canvas.width !== Math.round(w * px) || canvas.height !== Math.round(h * px)) {
      renderer.setPixelRatio(px); renderer.setSize(w, h, false);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
      arena.setPixelRatio(d);
    }
    camera.aspect = w / h;
    const D = h / (2 * Math.tan((camera.fov * Math.PI) / 360) * 150), pitch = (30 * Math.PI) / 180;
    camera.position.set(0, D * Math.sin(pitch), D * Math.cos(pitch));
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    return { w, h, rect: b.getBoundingClientRect() };
  }
  function ground(px, py, bx) {
    // screen points against the screen rect: the app may be scaled (compact desktop), so not its layout size
    ndc.set(((px - bx.rect.left) / (bx.rect.width || bx.w)) * 2 - 1, -(((py - bx.rect.top) / (bx.rect.height || bx.h)) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  // a unit stands at FOOT of its token's height; the token's lower band keeps the stats readable
  const footOf = (el, bx) => { const r = el.getBoundingClientRect(); return r.width ? ground(r.left + r.width / 2, r.top + r.height * (el.dataset.uid === "hero" ? 0.8 : FOOT), bx) : null; };
  // × the figure's board size so it fits its station: as wide against its token as a desktop token's figure at the
  // board centre (150 px per unit), capped in height and width
  function fit(u) {
    const el = u.info.el, w = el?.offsetWidth, h = el?.offsetHeight;
    if (!w || !u.fig || !u.pos) return 1;
    const g = u.fig.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox, base = (u.spec.scale || 1) * SIZE, px = ppu(u.pos), k = (w / TOKEN_W) * (150 / px.across);
    const grow = u.fig.J.head ? 1 + (u.fig.J.head.scale.x - 1) * 0.2 : 1;     // the sprite's enlarged head
    const tall = bb.max.y * grow * base * k * px.up, wide = (bb.max.x - bb.min.x) * base * k * px.across;
    return k * Math.min(1, ((FOOT + RISE) * h) / tall, (MAX_W * w) / wide);
  }
  // ------------------------------------------------------------------ heroes
  /* On the desktop layout each hero stands as a figure too: the figure of its portrait's card (the art the plate
   * showed), on its seat — the dais the battlefield scene raises outside the court (EmberArena3D.seat). Its plate stays
   * as the click and focus target and shows only its name and stats (`.hero-dais`). A portrait without a realistic
   * figure keeps its card. Touch layouts keep the plates (their consoles have no room for a dais). */
  const HERO_FIG = { ashdragon: "dragon" };        // the final dragon is its young kin, grown (its spec scale)
  const heroesOn = () => !failed && !off && !reduced() && typeof EmberArena3D !== "undefined" && typeof EmberModelFigures !== "undefined";
  const touchLayout = () => document.body.classList.contains("touch-layout");
  function heroSpec(el) {
    const k = el?.querySelector(".portrait-frame img")?.dataset.artKey;
    const sp = k && specOf(HERO_FIG[k] || k);
    return sp && EmberModelFigures.has(sp.id) ? sp : null;
  }
  const heroEl = (side) => document.getElementById(side === "p" ? "player-hero" : "enemy-hero");
  /** a hero's seat on the stage's ground: the dais's top centre, from stage pixels to the page */
  function seatOf(side, bx) {
    const q = EmberArena3D.seat?.(side), app = document.getElementById("app");
    if (!q || !app || typeof EmberViewport === "undefined") return null;
    const a = app.getBoundingClientRect(), k = a.width / EmberViewport.width;
    return ground(a.left + q.x * k, a.top + q.y * k, bx);
  }
  // how tall a hero stands on screen (× the design height of the page): the player's near, the enemy's across the court
  const HERO_H = { p: 0.24, e: 0.235 };
  // on the touch layouts a hero stands in its console's card slot: as tall as the card, and a little more
  const HERO_TOUCH = { p: 1.3, e: 1.2 };        // (the enemy's across the court: a little smaller)
  function fitHero(u) {
    if (!u.fig || !u.pos) return 1;
    const g = u.fig.mesh.geometry; if (!g.boundingBox) g.computeBoundingBox();
    // in layout pixels, as ppu measures (the app may be scaled on screen: a compact desktop)
    const app = document.getElementById("app"), k = app ? app.getBoundingClientRect().height / EmberViewport.height : 1;
    const slot = touchLayout() && u.info.el?.querySelector(".hero-card-inner")?.getBoundingClientRect();
    const px = ppu(u.pos), want = slot?.height ? (slot.height / k) * HERO_TOUCH[u.side] : HERO_H[u.side] * EmberViewport.height;
    return want / (g.boundingBox.max.y * (u.spec.scale || 1) * SIZE * px.up);
  }
  const refEl = (ref) => (ref.uid === "hero" ? document.getElementById(ref.side === "p" ? "player-hero" : "enemy-hero") : document.querySelector(`#minions .minion[data-side="${ref.side}"][data-uid="${ref.uid}"]`));

  // ------------------------------------------------------------------ tokens → units
  function sync() {
    if (!enabled() && !heroesOn()) {
      if (canvas) canvas.hidden = true;
      clearTokens();
      if (document.body.classList.contains("hero-daises")) { document.body.classList.remove("hero-daises"); if (typeof EmberArena3D !== "undefined") EmberArena3D.resize?.(); }
      return;
    }
    // minions stand as figures where the stage is enabled; on phones only the heroes do
    // (a phone's full row packs its tokens under 50 px — "compact" — and they stand as figures all the same)
    const tokens = enabled() ? [...document.querySelectorAll("#minions .minion")].filter((el) => specOf(el.dataset.cardid) && el.offsetWidth >= 30) : [];
    if (!enabled()) document.querySelectorAll("#minions .minion.miniature-ready, #minions .minion.miniature-pending").forEach((el) => el.classList.remove("miniature-ready", "miniature-pending"));
    else document.querySelectorAll("#minions .minion.miniature-pending").forEach((el) => { if (el.offsetWidth < 30) el.classList.remove("miniature-pending"); });
    const desk = heroesOn(), heroes = desk ? ["p", "e"].map((side) => ({ side, el: heroEl(side), sp: heroSpec(heroEl(side)) })).filter((h) => h.sp) : [];
    // the stations' layout (the plates become boxes round the figures): the scene re-seats its daises under them
    // (the phone layouts re-solve round the daises; the scene re-seats them)
    if (document.body.classList.contains("hero-daises") !== (desk && heroes.length > 0)) { document.body.classList.toggle("hero-daises", desk && heroes.length > 0); if (typeof EmberViewport !== "undefined") EmberViewport.resize(); EmberArena3D.resize?.(); }
    if (!tokens.length && !heroes.length && !arena) return;
    if (!init()) { clearTokens(); return; }
    const seen = new Set();
    for (const h of heroes) { seen.add(EmberVoxelArena.key(h.side, "hero")); h.el.classList.add("hero-station"); arena.set(h.side, "hero", h.sp.id, { el: h.el, hero: true }); }
    for (const side of ["p", "e"]) if (!heroes.some((h) => h.side === side)) heroEl(side)?.classList.remove("hero-station", "hero-dais");
    for (const el of tokens) {
      const { side, uid, cardid } = el.dataset;
      seen.add(EmberVoxelArena.key(side, uid));
      // a fresh token (renders replace them) gets its backdrop back at once — its card never shows as a flat token:
      // the figure assembles on it as soon as it is built (at once when prewarmed)
      const u = arena.set(side, uid, specOf(cardid).id, { el });
      if (u && !el.classList.contains("miniature-ready")) el.classList.add("miniature-pending");
      else if (!u) el.classList.remove("miniature-pending");   // (the render marks it; no figure after all: the card shows)
    }
    const gone = [];
    arena.each((u) => { if (!seen.has(u.k)) gone.push(u); });
    for (const u of gone) arena.drop(u.side, u.uid, true);
    wake();
  }

  const clearTokens = () => { document.querySelectorAll("#minions .minion.miniature-ready, #minions .minion.miniature-pending").forEach((el) => el.classList.remove("miniature-ready", "miniature-pending")); document.querySelectorAll(".hero.hero-station, .hero.hero-dais").forEach((el) => el.classList.remove("hero-station", "hero-dais")); };

  // ------------------------------------------------------------------ prewarm
  /* Figures are baked ahead in the worker (a pixel-sprite bake takes 0.1–2 s of worker time), one at a time from a
   * queue: urgent ones first (what an action is about to summon), then the cards in hand and deck, and once the queue
   * is empty, while a battle shows, every other figure in idle time — so an enemy's figure is rarely still baking
   * when it lands. The arena asks the baker directly for a unit that is already on the board. */
  const want = [], asked = new Set();          // want: [{ id, pri }] by priority (0 urgent · 1 hand/board · 2 deck)
  let baking = false, idle = 0;
  function prewarm(cardIds, opts = {}) {
    if (!enabled() || typeof EmberVoxelBaker === "undefined" || !EmberVoxelBaker.available) return;
    const pri = opts.urgent ? 0 : opts.pri ?? 1;
    for (const cid of cardIds || []) {
      const spec = cid && specOf(cid);
      if (!spec || EmberVoxelRender.cached(spec.id) || (asked.has(spec.id) && pri > 0)) continue;
      const at = want.findIndex((w) => w.id === spec.id);
      if (at >= 0) { if (want[at].pri <= pri) continue; want.splice(at, 1); }
      let i = want.findIndex((w) => w.pri > pri); if (i < 0) i = want.length;
      want.splice(i, 0, { id: spec.id, pri });
    }
    next();
  }
  function next() {
    if (baking) return;
    const id = want.shift()?.id;
    if (!id) { background(); return; }
    if (EmberVoxelRender.cached(id)) { next(); return; }
    baking = true; asked.add(id);
    EmberVoxelBaker.bake(id).then((data) => { if (!EmberVoxelRender.cached(id)) EmberVoxelRender.bake(id, data); }, () => {})
      .finally(() => { baking = false; next(); });
  }
  function background() {
    if (idle || !enabled() || !battle()?.offsetParent) return;
    const rest = KIT.ids().find((id) => !EmberVoxelRender.cached(id) && !asked.has(id));
    if (!rest) return;
    const later = globalThis.requestIdleCallback || ((fn) => setTimeout(fn, 400));
    idle = later(() => { idle = 0; if (!want.length) want.push({ id: rest, pri: 3 }); next(); });
  }

  // ------------------------------------------------------------------ cues from the effect layer
  /* kind: attack | hurt | death. opts: attack { toward, planned, ranged, tier, liftMs, contactMs, releaseMs, durationMs }
   * · hurt { tier, from, direction }. death → true when the figure shatters (the effect layer skips its demise). */
  function cue(side, uid, kind, opts) { if (!arena) return false; heat(); const r = arena.cue(side, uid, kind, opts); wake(); return r; }
  /** a damage contact on any unit: the victim figure glows and recoils; a melee figure's contact burst */
  function contact(ref, opts) { if (!arena) return false; heat(); box ||= fitCamera(); const r = arena.contact(ref, opts); wake(); return r; }
  /** a figure stands for this unit (melee = only when its attack is melee: the effect layer then skips its own melee
   *  decoration, the figure draws the weapon trail and the contact burst) */
  const owns = (side, uid, melee = false) => !!arena && arena.owns(side, uid, melee);
  /** EmberCombat.compile's figure hook: how this unit's figure attacks ({ melee, windup }) or null */
  const plan = (side, uid) => (arena ? arena.plan(side, uid) : null);
  const has = (side, uid) => !!arena && arena.has(side, uid);
  /** a hero stands as its figure on its dais (live) */
  const hero = (side) => !!arena && !!arena.unit(side, "hero") && arena.unit(side, "hero").state === "live";
  /** The aim on the ground (EmberVoxelArena.aim): from a figure's feet (a minion's, or a hero's on its dais) to the
   *  pointer (client pixels), or snapped onto the unit it rests on when that one may be taken (focus: { side, uid }).
   *  aim(null) clears it. → false when that attacker does not stand as a figure here (the page keeps its own cue) */
  function aim(from, pt, focus, locked) {
    if (!arena) return false;
    if (!from) { arena.aim(null); wake(); return false; }
    const u = arena.unit(from.side, from.uid);
    if (!u || u.state !== "live" || !u.pos) { arena.aim(null); return false; }
    box ||= fitCamera();
    const f = focus && locked && arena.unit(focus.side, focus.uid);      // (it snaps only onto a unit it may take)
    let to = f?.pos || null, r = 0.3;
    // (a locked ring sits just outside the unit's halo ring; its brackets further out)
    if (f?.pos) r = (f.info.hero ? 1.35 : 1.9) * (f.base?.scale.x || 0.3);
    else if (focus && locked) { const el = refEl(focus); to = el && box ? footOf(el, box) : null; }
    if (!to && pt) to = ground(pt.x, pt.y, box);
    if (!to) { arena.aim(null); return false; }
    arena.aim({ from: u.pos, to, r, locked: !!locked && !!focus });
    wake();
    return true;
  }
  /** a unit of this card stands as a voxel figure here (the effect layer then leaves out its card-shaped decorations) */
  const stands = (cid) => enabled() && !!specOf(cid);

  // ------------------------------------------------------------------ frames
  /* Pacing: while only idle breathing is on, the touch layouts draw the stage every other frame (30 fps); a blow, a
   * death, an arrival, the aim — anything fast (arena.hot, or a cue in the last 2.5 s) — draws every frame. */
  let hotUntil = 0, drawnAt = 0;
  const heat = (ms = 2500) => { hotUntil = Math.max(hotUntil, performance.now() + ms); };
  function render(now) {
    raf = 0;
    if (!renderer || document.hidden || !battle()?.offsetParent) return;
    if (touchLayout() && now < drawnAt + 30 && now > hotUntil && !arena.hot()) { raf = requestAnimationFrame(render); return; }
    drawnAt = now;
    const start = performance.now();
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    box = fitCamera();
    const busy = arena.step(now, camera, dt);
    if (dimmer) { const d = arena.dim(now); dimmer.style.opacity = d > 0.005 ? d.toFixed(3) : "0"; }
    if (EmberPixelPass.settings.on) pass.render(scene, camera, OVER, UNDER);
    else { camera.layers.enableAll(); renderer.render(scene, camera); camera.layers.set(0); }
    stats.frameMs = performance.now() - start;
    if (busy) wake();
    else if (canvas) canvas.hidden = true;
  }
  function wake() { if (!raf && renderer) { if (canvas) canvas.hidden = false; raf = requestAnimationFrame(render); } }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  // tokens are rendered by the UI (a render replaces them); follow them without the UI having to call in. The observer
  // syncs in the same microtask, before the paint, so a fresh token never shows its bright art for a frame
  let queued = false;
  const now = () => { try { sync(); } catch (error) { fail(error); } };
  const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; now(); }); };
  const handCards = () => prewarm([...document.querySelectorAll("#hand [data-cardid]")].map((el) => el.dataset.cardid));
  const watch = () => {
    const m = document.getElementById("minions"); if (!m) return false;
    new MutationObserver(now).observe(m, { childList: true, attributes: true, attributeFilter: ["data-cardid", "data-uid", "data-compact"] });
    for (const id of ["player-hero", "enemy-hero"]) { const h = document.getElementById(id); if (h) new MutationObserver(later).observe(h, { childList: true }); }
    const h = document.getElementById("hand"); if (h) new MutationObserver(() => { try { handCards(); } catch {} }).observe(h, { childList: true });
    later(); return true;
  };
  if (!watch()) document.addEventListener("DOMContentLoaded", watch, { once: true });
  addEventListener("ember:viewport", later);
  // a model that is ready after the board was drawn (its texture or mesh decoded late) takes its unit's place
  if (typeof EmberModelFigures !== "undefined") EmberModelFigures.onReady?.(later);

  return Object.freeze({
    sync, prewarm, cue, contact, has, owns, plan, stands, hero, aim,
    /** the heroes stand on their daises here (the desktop layout): the plate's own figure (EmberHeroFigure) stands down */
    heroDesk: () => heroesOn(),
    diagnostics: () => ({ ...(arena ? arena.diagnostics() : { figures: 0, cues: [], bakeMs: {}, dying: 0, baking: 0, live: 0 }), ...stats }),
  });
})();
