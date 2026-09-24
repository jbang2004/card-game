/* EmberHeroFigure — the player hero's voxel figure on the hero plate (docs/design/MINIATURES.md).
 * A transparent canvas sits over the plate with a gutter so the figure can rise above the frame;
 * the portrait fades behind it. The plate's DOM (stats, targeting, accessibility) and the rules
 * are untouched; any failure falls back to the plain portrait. Heroes with a figure are the
 * ones registered as card "hero:<heroId>" (EmberVoxelKit). Cues come from the effect layer:
 * hero power / hero attack → attack, damage → hurt (with the victim glow); victory from the
 * rendered state. */
const EmberHeroFigure = (() => {
  const THREE = EmberVesperThree, R = EmberVoxelRender, C = EmberVoxelClips, KIT = EmberVoxelKit;
  // gutter around the plate, in plate widths/heights
  const PAD = { left: 0.7, right: 0.7, top: 0.55, bottom: 0.02 };
  const HOT = [1.55, 1.53, 1.5], GOLD = [1.0, 0.45, 0.1];
  let host = null, canvas = null, renderer = null, scene = null, camera = null, fig = null, figId = null, failed = false, building = false;
  let clip = "idle", t = 0, T = 0, raf = 0, last = 0, glow = -1, cheered = false;
  const stats = { status: "idle", error: null, cues: [] };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("reduced-motion");
  const plate = () => document.getElementById("player-hero");
  const specFor = (s) => (s?.heroId ? KIT.forCard("hero:" + s.heroId) : null);

  function wanted(s) {
    return !failed && !!specFor(s) && !(typeof EmberViewport !== "undefined" && EmberViewport.mobile && !matchMedia("(hover: hover) and (pointer: fine)").matches) && !reduced();
  }
  function place() {
    const el = plate();
    if (!host || !el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    Object.assign(host.style, {
      left: el.offsetLeft - w * PAD.left + "px", top: el.offsetTop - h * PAD.top + "px",
      width: w * (1 + PAD.left + PAD.right) + "px", height: h * (1 + PAD.top + PAD.bottom) + "px",
    });
  }
  function ensure(spec) {
    if (failed || (fig && figId === spec.id) || building) return;
    try {
      if (!host) {
        host = document.createElement("div");
        host.id = "hero-figure";
        host.setAttribute("aria-hidden", "true");
        plate().after(host);
        canvas = document.createElement("canvas");
        canvas.className = "hero-figure-canvas";
        host.appendChild(canvas);
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setClearColor(0, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail("WebGL context lost"); });
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(20, 1, 0.1, 50);
      }
      place();
      building = true;
      // the voxels are made in a worker (EmberVoxelBaker); without one the bake runs in the page, and then only while
      // no combat sequence plays (0.3–0.7 s of main thread for a hero; the opening draw would stutter). The plate shows
      // its portrait until the figure is ready
      const quiet = () => typeof EmberFX === "undefined" || !EmberFX.busy;
      const bake = () => {
        if (!failed && !R.cached(spec.id) && !quiet()) { setTimeout(bake, 150); return; }
        building = false;
        if (failed) return;
        try {
          if (fig) { scene.remove(fig.root); R.dispose(fig); }
          fig = R.build(spec.id, { pixelRatio: Math.min(devicePixelRatio || 1, 2) });
          figId = spec.id;
          fig.root.rotation.y = 0.5;                      // three-quarters toward the enemy side
          scene.add(fig.root);
          // compile its shaders in parallel before the first draw (a synchronous compile stalls a frame)
          const shown = fig; stats.status = "warming";
          Promise.resolve(renderer.compileAsync(scene, camera)).catch(() => {}).then(() => {
            if (failed || fig !== shown) return;
            stats.status = "ready";
            plate()?.classList.add("hero-miniature-ready");
            wake();
          });
        } catch (error) { fail(error); }
      };
      const made = R.cached(spec.id) || typeof EmberVoxelBaker === "undefined" ? Promise.resolve() : EmberVoxelBaker.bake(spec.id).then((d) => R.bake(spec.id, d));
      made.catch(() => {}).then(() => setTimeout(bake, 0));
    } catch (error) { fail(error); }
  }
  function fail(error) {
    failed = true;
    stats.status = "fallback";
    stats.error = String(error?.message || error);
    cancelAnimationFrame(raf); raf = 0;
    try { if (fig) R.dispose(fig); renderer?.dispose(); } catch {}
    fig = null; renderer = null;
    host?.remove(); host = null;
    plate()?.classList.remove("hero-miniature-ready");
    console.warn("Hero figure unavailable; using the hero portrait.", stats.error);
  }
  function frame(now) {
    raf = 0;
    if (!renderer || !fig || stats.status !== "ready" || host.hidden || document.hidden) return;
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now; T += dt; t += dt;
    place();
    const w = host.clientWidth, h = host.clientHeight, dpr = Math.min(devicePixelRatio || 1, 2);
    if (w && h && (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))) {
      renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); R.setPixelRatio(fig, dpr);
      camera.aspect = w / h;
      // the figure stands on the plate's bottom edge and rises through the top gutter
      const H = 1.05 * (fig.spec.scale || 1), tall = 1 + PAD.top + PAD.bottom, span = H * tall / 1.05;
      const d = span / (2 * Math.tan((camera.fov * Math.PI) / 360));
      camera.position.set(0, span / 2 - 0.02, d); camera.lookAt(0, span / 2 - 0.02, 0); camera.updateProjectionMatrix();
    }
    if (!C.pose(fig, clip, t, T) && clip !== "idle") { clip = "idle"; t = 0; C.pose(fig, clip, t, T); }
    if (glow >= 0) {
      const u = Math.max(0, 1 - glow / 11);
      if (glow === 0) R.setHit(fig, ...HOT); else R.setHit(fig, GOLD[0] * u * u, GOLD[1] * u * u, GOLD[2] * u * u);
      glow += dt * 60; if (glow > 12) { glow = -1; R.setHit(fig, 0, 0, 0); }
    }
    renderer.render(scene, camera);
    wake();
  }
  function wake() { if (!raf && renderer && fig) raf = requestAnimationFrame(frame); }
  function sync(s) {
    const spec = specFor(s);
    if (!wanted(s)) {
      if (host) host.hidden = true;
      plate()?.classList.remove("hero-miniature-ready");
      return;
    }
    ensure(spec);
    if (!host) return;
    host.hidden = false;
    if (fig && stats.status === "ready") plate()?.classList.add("hero-miniature-ready");
    if (s.winner === "p" && !cheered) { cheered = true; cue("victory"); }
    else if (!s.winner) cheered = false;
    wake();
  }
  function active(side) { return side === "p" && !!fig && stats.status === "ready" && !!host && !host.hidden; }
  /** kind: 'shot' | 'volley' | 'hurt' | 'victory' */
  function cue(kind) {
    if (!fig || host?.hidden) return;
    stats.cues.push({ kind, at: Math.round(performance.now()) });
    if (stats.cues.length > 20) stats.cues.shift();
    if (kind === "hurt") { clip = "hurt"; t = 0; glow = 0; }
    else if (kind === "victory") { clip = "victory"; t = 0; }
    else { clip = "attack"; t = 0; }
    wake();
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  window.addEventListener("resize", place, { passive: true });
  return Object.freeze({ sync, cue, active, get figure() { return fig; }, diagnostics: () => ({ ...stats, cues: stats.cues.slice() }) });
})();
