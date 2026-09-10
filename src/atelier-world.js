/* One continuous illustrated environment. Responsive composition owns its cache;
 * decorative lighting never participates in gameplay or hit testing. */
const AtelierWorld = (() => {
  const image = new Image(),
    cache = document.createElement("canvas");
  const ctx = cache.getContext("2d");
  let ready = false,
    dirty = true,
    key = "",
    dusk = false,
    hover = null;
  const hits = [];
  const layers = [
    { id: "chimney", key: "brewery", focus: [145, 160], light: "#ffd28a" },
    {
      id: "crystals",
      key: "observatory",
      focus: [1430, 160],
      light: "#aa9cff",
    },
    { id: "tree", key: "mine", focus: [125, 690], light: "#75d9ff" },
    { id: "forge", key: "forge", focus: [1460, 700], light: "#ffc180" },
  ];
  image.onload = () => {
    ready = true;
    dirty = true;
  };
  image.onerror = () => {
    ready = true;
    dirty = true;
  };
  image.src = PremiumAssets.board;
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
  function paint(c, t, view, theme, phase, reduced, low) {
    const V = EmberViewport,
      W = V.width,
      H = V.height;
    const next = [W, H, V.mobile, view, dusk].join(":");
    if (dirty || next !== key) {
      cache.width = W;
      cache.height = H;
      ctx.fillStyle = "#231712";
      ctx.fillRect(0, 0, W, H);
      if (image.naturalWidth) {
        if (!V.mobile) ctx.drawImage(image, 0, 0, W, H);
        else {
          const scale = Math.max(W / image.width, H / image.height);
          ctx.drawImage(
            image,
            (W - image.width * scale) / 2,
            (H - image.height * scale) / 2,
            image.width * scale,
            image.height * scale,
          );
          // Keep the mobile battle surface on the same continuous tavern
          // tabletop as desktop. The transparent arena remains the hit area;
          // units and the existing frame provide the gameplay structure.
        }
      }
      if (dusk) {
        ctx.fillStyle = "#10153255";
        ctx.fillRect(0, 0, W, H);
      }
      dirty = false;
      key = next;
    }
    c.drawImage(cache, 0, 0);
    if (!V.mobile)
      for (const a of layers)
        glow(
          c,
          ...a.focus,
          85,
          a.light,
          (hover === a.id ? 0.16 : 0.045) +
            (reduced ? 0 : Math.sin(t * 1.3) * 0.008),
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
  return {
    paint,
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
    setHover: (id) => (hover = id),
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
      return !ready;
    },
    get cacheSize() {
      return [cache.width, cache.height];
    },
    invalidate() {
      dirty = true;
    },
  };
})();
