/* Puts the Vesper miniature (EmberVesperModel) on the player's hero plate when the
 * player plays the ranger. A transparent canvas sits over the plate with a gutter
 * so the figure can rise above the frame and the arrow can leave toward the enemy;
 * the portrait art fades behind it. Rules and the plate's DOM (stats, targeting,
 * accessibility) are untouched; any failure falls back to the plain portrait.
 * Cues come from the effect layer: power / hero attack → shot, damage → hurt,
 * victory from the rendered state. */
const EmberVesperHero = (() => {
  const HERO_ID = "ranger";
  // gutter around the 156×231 plate, in plate widths/heights
  const PAD = { left: 0.7, right: 0.7, top: 0.55, bottom: 0.02 };
  let app = null, host = null, failed = false, cheered = false, nextFidget = 0;
  const stats = { status: "idle", error: null, cues: [] };
  const reduced = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.body.classList.contains("reduced-motion");
  const plate = () => document.getElementById("player-hero");

  function wanted(s) {
    return (
      !failed &&
      s?.heroId === HERO_ID &&
      typeof EmberVesperModel !== "undefined" &&
      !(typeof EmberViewport !== "undefined" && EmberViewport.mobile) &&
      !reduced()
    );
  }
  function place() {
    const el = plate();
    if (!host || !el) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    Object.assign(host.style, {
      left: el.offsetLeft - w * PAD.left + "px",
      top: el.offsetTop - h * PAD.top + "px",
      width: w * (1 + PAD.left + PAD.right) + "px",
      height: h * (1 + PAD.top + PAD.bottom) + "px",
    });
  }
  function ensure() {
    if (app || failed) return;
    try {
      host = document.createElement("div");
      host.id = "vesper-miniature";
      host.setAttribute("aria-hidden", "true");
      plate().after(host);
      place();
      const V = EmberVesperThree.Vector3;
      app = EmberVesperModel.create(host, {
        camera: new V(0, 0.84, 2.75),
        look: new V(0, 0.74, 0),
        plinth: false,
        aim: new V(6, 3, -1.8),
        flyOut: 1.1,
        onFrame: tick,
      });
      stats.status = "ready";
      plate().classList.add("hero-miniature-ready");
    } catch (error) {
      fail(error);
    }
  }
  function fail(error) {
    failed = true;
    stats.status = "fallback";
    stats.error = String(error?.message || error);
    try { app?.destroy(); } catch {}
    app = null;
    host?.remove();
    host = null;
    plate()?.classList.remove("hero-miniature-ready");
    console.warn("Vesper miniature unavailable; using the hero portrait.", stats.error);
  }
  function tick(S) {
    place();
    const t = performance.now();
    const idle = S.atk < 0 && S.hurt < 0 && !(S.vic >= 0) && !(S.fid >= 0);
    if (!nextFidget) nextFidget = t + 9000;
    if (idle && t > nextFidget) { app.fidget(); nextFidget = t + 14000 + Math.random() * 8000; }
  }
  function sync(s) {
    if (!wanted(s)) {
      if (host) host.hidden = true;
      plate()?.classList.remove("hero-miniature-ready");
      return;
    }
    ensure();
    if (!app) return;
    host.hidden = false;
    plate().classList.add("hero-miniature-ready");
    if (s.winner === "p" && !cheered) { cheered = true; cue("victory"); }
    else if (!s.winner) cheered = false;
  }
  function active(side) {
    return side === "p" && !!app && host && !host.hidden;
  }
  /** kind: 'shot' | 'volley' | 'hurt' | 'victory' | 'fidget'; lead = seconds until the arrow leaves */
  function cue(kind, lead) {
    if (!app || host?.hidden) return;
    stats.cues.push({ kind, at: Math.round(performance.now()) });
    if (stats.cues.length > 20) stats.cues.shift();
    if (kind === "hurt") app.hurt(true);
    else if (kind === "victory") app.victory();
    else if (kind === "fidget") app.fidget();
    else app.attack(kind === "volley" ? "volley" : "shot", lead ?? 0.35);
    nextFidget = performance.now() + 12000;
  }
  window.addEventListener("resize", place, { passive: true });
  return Object.freeze({
    sync,
    cue,
    active,
    get app() { return app; },
    diagnostics: () => ({ ...stats, cues: stats.cues.slice() }),
  });
})();
