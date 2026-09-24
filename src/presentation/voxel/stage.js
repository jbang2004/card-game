/* EmberMiniatures — the voxel battlefield (docs/design/MINIATURES.md): one transparent canvas over the board, one
 * renderer, scene and camera, and an EmberVoxelArena holding the figures. Every minion token whose card has a voxel
 * figure gets one standing on it: the figure's ground point is its token's (so the effect layer's recoils and
 * shakes carry it), the token's art dims to a backdrop while the figure stands, and the cues come from the effect
 * layer (attack · contact · death). A melee figure leaves its token for the attack and dashes to the target on the
 * director's timeline while the token stays home with its stats; a ranged figure shoots from its token and EmberFx2
 * flies the projectile. Figures are baked on first use (cached per figure) — until then the token stays flat. Rules
 * state is never read beyond the DOM; any failure falls back to flat tokens. */
const EmberMiniatures = (() => {
  const THREE = EmberVesperThree, KIT = EmberVoxelKit;
  const SIZE = 1.25;            // board size of a figure (× its spec.scale): a miniature a head taller than its token
  let renderer = null, scene = null, camera = null, canvas = null, arena = null, failed = false, raf = 0, last = 0, box = null;
  const stats = { status: "idle", error: null, frameMs: 0 };
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3();
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("reduced-motion");
  const enabled = () => !failed && !(typeof EmberViewport !== "undefined" && EmberViewport.mobile) && !reduced();
  const battle = () => document.getElementById("battle");
  const specOf = (cid) => KIT.forCard(cid);
  const dpr = () => Math.min(devicePixelRatio || 1, 2);

  function init() {
    if (renderer || failed) return !!renderer;
    try {
      canvas = document.createElement("canvas");
      canvas.id = "miniature-stage";
      canvas.setAttribute("aria-hidden", "true");
      battle().appendChild(canvas);
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;          // figures grade themselves (EmberVoxelRender)
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail("WebGL context lost"); });
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(18, 1, 1, 200);
      arena = EmberVoxelArena.create(scene, {
        size: SIZE, pixelRatio: dpr, wake,
        bake: (id) => EmberVoxelBaker.bake(id),                          // voxelize in a worker, off the main thread
        ready: () => typeof EmberFX === "undefined" || !EmberFX.busy,       // appear between actions, never mid-sequence
        warm: (root) => {                                  // compile its programs in parallel (KHR_parallel_shader_compile)
          root.visible = true;
          try { return renderer.compileAsync(scene, camera); } finally { root.visible = false; }
        },
        where: (ref) => { const el = refEl(ref); return el && el.isConnected && box ? footOf(el, box) : null; },
        live: (u, on) => u.info.el?.classList.toggle("miniature-ready", on),
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
    document.querySelectorAll("#minions .minion.miniature-ready").forEach((el) => el.classList.remove("miniature-ready"));
    try { arena?.dispose(); renderer?.dispose(); } catch {}
    arena = null; renderer = null; canvas?.remove(); canvas = null;
    console.warn("Battle miniatures unavailable; using flat tokens.", stats.error);
  }

  // camera: looks down onto the board like the arena; one world unit ≈ 150 px at the board centre
  function fitCamera() {
    const b = battle(), w = b.clientWidth, h = b.clientHeight, d = dpr();
    if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(h * d)) {
      renderer.setPixelRatio(d); renderer.setSize(w, h, false);
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
    ndc.set(((px - bx.rect.left) / bx.w) * 2 - 1, -(((py - bx.rect.top) / bx.h) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  // a unit stands at 80% of its token's height (the token's lower band keeps the stats readable)
  const footOf = (el, bx) => { const r = el.getBoundingClientRect(); return r.width ? ground(r.left + r.width / 2, r.top + r.height * 0.8, bx) : null; };
  const refEl = (ref) => (ref.uid === "hero" ? document.getElementById(ref.side === "p" ? "player-hero" : "enemy-hero") : document.querySelector(`#minions .minion[data-side="${ref.side}"][data-uid="${ref.uid}"]`));

  // ------------------------------------------------------------------ tokens → units
  function sync() {
    if (!enabled()) {
      if (canvas) canvas.hidden = true;
      document.querySelectorAll("#minions .minion.miniature-ready").forEach((el) => el.classList.remove("miniature-ready"));
      return;
    }
    const tokens = [...document.querySelectorAll("#minions .minion")].filter((el) => specOf(el.dataset.cardid) && el.dataset.compact !== "true");
    if (!tokens.length && !arena) return;
    if (!init()) return;
    const seen = new Set();
    for (const el of tokens) {
      const { side, uid, cardid } = el.dataset;
      seen.add(EmberVoxelArena.key(side, uid));
      arena.set(side, uid, specOf(cardid).id, { el });    // a fresh token (renders replace them) gets its backdrop back
    }
    const gone = [];
    arena.each((u) => { if (!seen.has(u.k)) gone.push(u); });
    for (const u of gone) arena.drop(u.side, u.uid, true);
    wake();
  }

  // ------------------------------------------------------------------ cues from the effect layer
  /* kind: attack | hurt | death. opts: attack { toward, planned, ranged, tier, liftMs, contactMs, releaseMs, durationMs }
   * · hurt { tier, from, direction }. death → true when the figure shatters (the effect layer skips its demise). */
  function cue(side, uid, kind, opts) { if (!arena) return false; const r = arena.cue(side, uid, kind, opts); wake(); return r; }
  /** a damage contact on any unit: the victim figure glows and recoils; a melee figure's contact burst */
  function contact(ref, opts) { if (!arena) return false; box ||= fitCamera(); const r = arena.contact(ref, opts); wake(); return r; }
  /** a figure stands for this unit (melee = only when its attack is melee: the effect layer then skips its own melee
   *  decoration, the figure draws the weapon trail and the contact burst) */
  const owns = (side, uid, melee = false) => !!arena && arena.owns(side, uid, melee);
  /** EmberCombat.compile's figure hook: how this unit's figure attacks ({ melee, windup }) or null */
  const plan = (side, uid) => (arena ? arena.plan(side, uid) : null);
  const has = (side, uid) => !!arena && arena.has(side, uid);

  // ------------------------------------------------------------------ frames
  function render(now) {
    raf = 0;
    if (!renderer || document.hidden || !battle()?.offsetParent) return;
    const start = performance.now();
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    box = fitCamera();
    const busy = arena.step(now, camera, dt);
    renderer.render(scene, camera);
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
  const watch = () => { const m = document.getElementById("minions"); if (!m) return false; new MutationObserver(now).observe(m, { childList: true, attributes: true, attributeFilter: ["data-cardid", "data-uid", "data-compact"] }); later(); return true; };
  if (!watch()) document.addEventListener("DOMContentLoaded", watch, { once: true });
  addEventListener("ember:viewport", later);

  return Object.freeze({
    sync, cue, contact, has, owns, plan,
    diagnostics: () => ({ ...(arena ? arena.diagnostics() : { figures: 0, cues: [], bakeMs: {}, dying: 0, baking: 0, live: 0 }), ...stats }),
  });
})();
