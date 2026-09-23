/* Cached scene composition for the 2D world canvas. Theme data owns artwork
 * and light; this renderer owns only presentation, and shares the existing
 * effects clock.
 *
 * The lobby paints the home scene here. A battle paints only the ambient
 * shade: the arena itself is rendered live by EmberArena3D into `#arena-gl`,
 * which sits directly above this canvas, so what is painted here is the
 * fallback that shows before the arena's first frame or when WebGL2 is
 * unavailable. */
const AtelierWorld = (() => {
  const cache = document.createElement("canvas"),
    ctx = cache.getContext("2d");
  const theme = EmberTheme.definition;
  let dirty = true,
    key = "",
    dusk = false,
    hover = null,
    activeImage = null,
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
    const artwork = scene.art;
    activeArtwork = role === "battle" ? "arena" : artwork;
    activeImage = artwork ? EmberTheme.image(artwork) : null;
    const next = [W, H, role, artwork, role === "home" && dusk].join(":");
    if (dirty || next !== key) {
      cache.width = W;
      cache.height = H;
      ctx.fillStyle = theme.light.ambient;
      ctx.fillRect(0, 0, W, H);
      if (activeImage?.naturalWidth) {
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
        // Ember-lit obsidian: the arena's own palette, so the instant before
        // its first frame (and a WebGL-less browser) still reads as the same place.
        const veil = ctx.createRadialGradient(W * .5, H * .55, W * .05, W * .5, H * .55, W * .8);
        veil.addColorStop(0, "#1a1218");
        veil.addColorStop(.7, "#120c10");
        veil.addColorStop(1, "#2a1008");
        ctx.fillStyle = veil;
        ctx.fillRect(0, 0, W, H);
      }
      // 底图还没解码完就别记账：否则缓存里只剩一层底色，而 dirty/key 已经
      // 宣称"这一帧画好了"，首次进大厅就一直是纯色背景。解码好了（onload 会
      // 再置 dirty）或者彻底失败了（complete 且仍是 0）才收下这一帧。
      if (!activeImage || activeImage.naturalWidth || activeImage.complete) {
        dirty = false;
        key = next;
      }
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
      return dirty || !!(activeImage && !activeImage.complete);
    },
    get cacheSize() {
      return [cache.width, cache.height];
    },
    invalidate() {
      dirty = true;
    },
  });
})();
