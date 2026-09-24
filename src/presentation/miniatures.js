/* Battlefield miniatures stage (EmberMiniatures): one transparent canvas over the
 * board, one renderer, one scene, one camera. Every minion token whose card has
 * an EmberMiniatureSpecs entry gets a chibi figure standing on it; the figure
 * follows the token's on-screen box every frame (so the effect layer's lunges,
 * shakes and slides carry it), faces the opposing side, and plays clips on
 * cues from the effect layer. Tokens keep all input, text and stats; their art
 * dims behind the figure. Rules state is never read beyond the DOM.
 * See docs/design/MINIATURES.md. */
const EmberMiniatures = (() => {
  const THREE = EmberVesperThree, K = EmberMiniatureKit;
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let renderer = null, scene = null, camera = null, canvas = null, failed = false, raf = 0, last = 0;
  const figs = new Map(); // key "side:uid" -> {fig, el, clip, t, yaw, ...}
  const dying = [];
  const stats = { status: "idle", error: null, figures: 0, frameMs: 0, cues: [] };
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = V3();
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("reduced-motion");
  const enabled = () => !failed && !(typeof EmberViewport !== "undefined" && EmberViewport.mobile) && !reduced();
  const battle = () => document.getElementById("battle");

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
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.02;
      canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail("WebGL context lost"); });
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(18, 1, 1, 200);
      scene.add(new THREE.HemisphereLight(0xd8e0ff, 0x3a3226, 0.95));
      const key = new THREE.DirectionalLight(0xffdcb0, 2.1); key.position.set(3, 6, 5); scene.add(key);
      const rim = new THREE.DirectionalLight(0xa8c8ff, 1.3); rim.position.set(-4, 3, -5); scene.add(rim);
      stats.status = "ready";
      return true;
    } catch (error) { fail(error); return false; }
  }
  function fail(error) {
    failed = true; stats.status = "fallback"; stats.error = String(error?.message || error);
    cancelAnimationFrame(raf); raf = 0;
    for (const f of figs.values()) f.el?.classList.remove("miniature-ready");
    figs.clear(); dying.length = 0;
    try { renderer?.dispose(); } catch {}
    renderer = null; canvas?.remove(); canvas = null;
    console.warn("Battle miniatures unavailable; using flat tokens.", stats.error);
  }

  // camera: looks down onto the board like the arena, sized to the battle box
  function fitCamera() {
    const b = battle(), w = b.clientWidth, h = b.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
      canvas.style.width = w + "px"; canvas.style.height = h + "px";
    }
    camera.aspect = w / h;
    // one world unit ≈ 150 px at the board centre
    const D = h / (2 * Math.tan((camera.fov * Math.PI) / 360) * 150), pitch = (30 * Math.PI) / 180;
    camera.position.set(0, D * Math.sin(pitch), D * Math.cos(pitch));
    camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    return { w, h, rect: b.getBoundingClientRect() };
  }
  function ground(px, py, box) {
    ndc.set(((px - box.rect.left) / box.w) * 2 - 1, -(((py - box.rect.top) / box.h) * 2 - 1));
    ray.setFromCamera(ndc, camera);
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  }
  // screen box of a token → ground point under the figure's feet
  function footOf(el, box) {
    const r = el.getBoundingClientRect();
    if (!r.width) return null;
    return ground(r.left + r.width / 2, r.top + r.height * 0.8, box);
  }

  function key(side, uid) { return side + ":" + uid; }
  function sync() {
    if (!enabled()) { if (canvas) canvas.hidden = true; for (const f of figs.values()) f.el?.classList.remove("miniature-ready"); return; }
    const tokens = [...document.querySelectorAll("#minions .minion")].filter((el) => EmberMiniatureSpecs[el.dataset.cardid] && el.dataset.compact !== "true");
    if (!tokens.length && !figs.size && !dying.length) { if (canvas) canvas.hidden = true; return; }
    if (!init()) return;
    canvas.hidden = false;
    const seen = new Set();
    for (const el of tokens) {
      const k = key(el.dataset.side, el.dataset.uid);
      seen.add(k);
      let f = figs.get(k);
      if (!f || f.cid !== el.dataset.cardid) {
        if (f) remove(k, false);
        const fig = K.build(EmberMiniatureSpecs[el.dataset.cardid]);
        scene.add(fig.root);
        f = { fig, el, cid: el.dataset.cardid, side: el.dataset.side, clip: "spawn", t: 0, yaw: null, face: null };
        figs.set(k, f);
      }
      f.el = el;
      el.classList.add("miniature-ready");
    }
    for (const k of [...figs.keys()]) if (!seen.has(k)) remove(k, true);
    stats.figures = figs.size;
    wake();
  }
  function remove(k, animate) {
    const f = figs.get(k); if (!f) return;
    figs.delete(k);
    f.el?.classList.remove("miniature-ready");
    if (animate && f.clip === "death") { dying.push(f); return; }
    if (animate) { f.clip = "death"; f.t = 0; dying.push(f); return; }
    scene.remove(f.fig.root); K.dispose(f.fig);
  }

  /* kind: attack | hurt | death; opts.toward = {side, uid} for attacks */
  function cue(side, uid, kind, opts = {}) {
    const f = figs.get(key(side, uid)) || dying.find((d) => d.side === side && d.el?.dataset.uid === String(uid));
    if (!f) return false;
    stats.cues.push({ key: key(side, uid), kind, at: Math.round(performance.now()) });
    if (stats.cues.length > 30) stats.cues.shift();
    if (kind === "death") { f.clip = "death"; f.t = 0; f.frozen = true; return true; }
    f.clip = kind; f.t = 0;
    if (kind === "attack" && opts.toward) f.toward = opts.toward;
    wake();
    return true;
  }
  const has = (side, uid) => figs.has(key(side, uid));

  function facing(f, box, from) {
    // idle: turned three-quarters toward the opponents' side of the board
    const toward = f.toward && f.clip === "attack" ? f.toward : null;
    let target = null;
    if (toward) {
      const el = toward.uid === "hero" ? document.getElementById(toward.side === "p" ? "player-hero" : "enemy-hero") : document.querySelector(`#minions .minion[data-side="${toward.side}"][data-uid="${toward.uid}"]`);
      if (el) target = footOf(el, box);
    }
    // local forward: +X for quadrupeds, +Z for humanoids
    const quad = f.fig.kind === "quadruped";
    let want;
    if (target) { const dx = target.x - from.x, dz = target.z - from.z; want = quad ? Math.atan2(-dz, dx) : Math.atan2(dx, dz); }
    else want = f.side === "p" ? (f.fig.kind === "quadruped" ? -0.55 : 0.35) : (f.fig.kind === "quadruped" ? Math.PI + 0.55 : -0.35);
    if (f.yaw == null) f.yaw = want;
    let d = want - f.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    f.yaw += d * Math.min(1, 0.2 + (target ? 0.4 : 0.08));
    f.fig.root.rotation.y = f.yaw;
  }

  function frame(now) {
    raf = 0;
    if (!renderer || document.hidden || !battle()?.offsetParent) return;
    const start = performance.now();
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    const box = fitCamera();
    const T = now / 1000;
    for (const f of figs.values()) {
      if (!f.el.isConnected) continue;
      const p = footOf(f.el, box);
      if (p) f.fig.root.position.copy(p);
      facing(f, box, f.fig.root.position);
      f.t += dt;
      if (!K.pose(f.fig, f.clip, f.t, T) && f.clip !== "idle") { f.clip = "idle"; f.t = 0; f.toward = null; }
    }
    for (let i = dying.length - 1; i >= 0; i--) {
      const f = dying[i]; f.t += dt;
      if (!K.pose(f.fig, "death", f.t, T)) { scene.remove(f.fig.root); K.dispose(f.fig); dying.splice(i, 1); }
    }
    renderer.render(scene, camera);
    stats.frameMs = performance.now() - start;
    if (figs.size || dying.length) wake();
    else if (canvas) canvas.hidden = true;
  }
  function wake() { if (!raf && renderer) raf = requestAnimationFrame(frame); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  // tokens are rendered by the UI; follow them without the UI having to call in
  let queued = false;
  const later = () => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; try { sync(); } catch (error) { fail(error); } }); };
  const watch = () => { const m = document.getElementById("minions"); if (!m) return false; new MutationObserver(later).observe(m, { childList: true, attributes: true, attributeFilter: ["data-cardid", "data-uid", "data-compact"] }); later(); return true; };
  if (!watch()) document.addEventListener("DOMContentLoaded", watch, { once: true });
  addEventListener("ember:viewport", later);

  return Object.freeze({
    sync, cue, has,
    diagnostics: () => ({ ...stats, cues: stats.cues.slice(), dying: dying.length }),
  });
})();
