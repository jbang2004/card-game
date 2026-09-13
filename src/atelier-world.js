/* Cached scene composition. Theme data owns artwork and light; this renderer
 * owns only presentation, and shares the existing effects clock. */
const AtelierWorld = (() => {
  const cache = document.createElement("canvas"),
    ctx = cache.getContext("2d");
  const theme = EmberTheme.definition;
  let dirty = true,
    key = "",
    dusk = false,
    hover = null,
    activeImage,
    encounter = "warden",
    activeArtwork = "home";
  const hits = [];
  const layers = Object.freeze(
    theme.scenery.map((a) => ({
      ...a,
      light: a.warm ? theme.light.warm : theme.light.glow,
    })),
  );
  window.addEventListener("ember:theme-art", () => {
    dirty = true;
  });
  function glow(c, x, y, r, color, alpha) {
    c.save();
    c.globalAlpha = alpha;
    c.globalCompositeOperation = "screen";
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, color + "00");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }
  function paint(c, t, view, _theme, _phase, reduced, low) {
    const V = EmberViewport,
      W = V.width,
      H = V.height;
    const role = view === "lobby" ? "home" : "battle",
      scene = theme.scenes[role];
    // Content can introduce a boss before it introduces a bespoke backdrop.
    // Keep that encounter playable on the approved battle scene rather than
    // throwing during render (named shipped bosses still have unique scenes).
    const artwork =
      role === "battle" ? theme.encounters[encounter] || scene.art : scene.art;
    activeArtwork = artwork;
    activeImage = EmberTheme.image(artwork);
    const next = [W, H, role, artwork, role === "home" && dusk].join(":");
    if (dirty || next !== key) {
      cache.width = W;
      cache.height = H;
      ctx.fillStyle = theme.light.ambient;
      ctx.fillRect(0, 0, W, H);
      if (activeImage.naturalWidth) {
        const scale = Math.max(
          W / activeImage.naturalWidth,
          H / activeImage.naturalHeight,
        );
        const w = activeImage.naturalWidth * scale,
          h = activeImage.naturalHeight * scale;
        const focus = H > W ? scene.portraitFocus : scene.focus;
        ctx.drawImage(
          activeImage,
          (W - w) * focus[0],
          (H - h) * focus[1],
          w,
          h,
        );
      }
      ctx.save();
      ctx.globalAlpha = scene.shade + (role === "home" && dusk ? 0.22 : 0);
      ctx.fillStyle = theme.light.ambient;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      if (role === "battle") {
        const veil = ctx.createRadialGradient(W * .5, H * .48, W * .08, W * .5, H * .48, W * .65);
        veil.addColorStop(0, "rgba(8, 18, 32, .46)");
        veil.addColorStop(.65, "rgba(8, 18, 32, .24)");
        veil.addColorStop(1, "rgba(8, 18, 32, .06)");
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, W, H);
      }
      dirty = false;
      key = next;
    }
    c.drawImage(cache, 0, 0);
    if (role === "home" && !V.mobile && !low)
      for (const a of layers)
        glow(
          c,
          ...a.focus,
          85,
          a.light,
          (hover === a.id ? 0.12 : 0.018) +
            (reduced ? 0 : Math.sin(t * 1.3) * 0.006),
        );
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i],
        p = (performance.now() - h.t) / 900;
      if (p >= 1) {
        hits.splice(i, 1);
        continue;
      }
      glow(c, h.x, h.y, 40 + p * 55, h.color, (1 - p) * 0.25);
    }
  }
  return Object.freeze({
    paint,
    setEncounter(id) {
      const resolved = Object.hasOwn(theme.encounters, id) ? id : null;
      if (encounter !== resolved) {
        encounter = resolved;
        dirty = true;
      }
    },
    get sceneId() {
      return activeArtwork;
    },
    layers,
    ping(id) {
      const a = layers.find((x) => x.id === id);
      if (a)
        hits.push({
          x: a.focus[0],
          y: a.focus[1],
          color: a.light,
          t: performance.now(),
        });
    },
    setHover(id) {
      hover = id;
    },
    setDusk(v) {
      dusk = !!v;
      dirty = true;
      document.body.classList.toggle("world-dusk", dusk);
      return dusk;
    },
    get dusk() {
      return dusk;
    },
    get loading() {
      return dirty || !activeImage?.complete;
    },
    get cacheSize() {
      return [cache.width, cache.height];
    },
    invalidate() {
      dirty = true;
    },
  });
})();
