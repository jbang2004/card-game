/* Layered portraits: persistent surfaces, stable layout and one display-frame clock.
 * No rule access. Resize/visibility work is observer-driven, never per-frame layout. */
const EmberPortraits = (() => {
  const entries = new Map(),
    assets = new Map(),
    phases = new Map();
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = false,
    low = false,
    active = 0,
    candidates = [],
    frames = 0,
    resizes = 0,
    pendingLoads = 0,
    raf = 0;
  const mobile = () => document.body.classList.contains("touch-layout");
  const cacheLimit = () => (mobile() ? 8 : 16);
  function wake() {
    if (!raf && !disabled()) raf = requestAnimationFrame(tick);
  }
  const hash = (text) =>
    ([...text].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % 10000) /
    1000;
  const disabled = () =>
    reduced || low || document.hidden || motionPreference.matches;
  function load(id) {
    if (!assets.has(id)) {
      if (pendingLoads >= 2) return null;
      pendingLoads++;
      const record = { ready: false, images: {}, used: performance.now() };
      assets.set(id, record);
      Promise.all(
        Object.entries(MotionAssets[id]).map(
          ([role, src]) =>
            new Promise((resolve, reject) => {
              const image = new Image();
              image.onload = () => resolve([role, image]);
              image.onerror = reject;
              image.src = src;
            }),
        ),
      )
        .then((images) => {
          record.images = Object.fromEntries(images);
          record.ready = true;
        })
        .catch(() => {
          record.failed = true;
        })
        .finally(() => {
          pendingLoads--;
          wake();
        });
    }
    const record = assets.get(id);
    record.used = performance.now();
    return record;
  }
  function trimCache(keep) {
    for (const [id, record] of [...assets].sort(
      (a, b) => a[1].used - b[1].used,
    )) {
      if (assets.size <= cacheLimit()) break;
      if (keep.has(id) || (!record.ready && !record.failed)) continue;
      record.images = {};
      assets.delete(id);
    }
  }
  function measure(e) {
    // Layout dimensions exclude the summon/lunge transform: no reallocations mid-motion.
    const width = e.host.clientWidth,
      height = e.host.clientHeight;
    e.sized = width > 0 && height > 0;
    if (!e.sized) return;
    const ratio = Math.min(
      devicePixelRatio || 1,
      1.5,
      500 / width,
      600 / height,
    );
    const w = Math.max(1, Math.round(width * ratio)),
      h = Math.max(1, Math.round(height * ratio));
    if (e.canvas.width !== w || e.canvas.height !== h) {
      e.painted = false;
    }
    e.width = w;
    e.height = h;
    const p = getComputedStyle(e.img).objectPosition.split(" ");
    e.px = Number.isFinite(parseFloat(p[0])) ? parseFloat(p[0]) / 100 : 0.5;
    e.py = Number.isFinite(parseFloat(p[1])) ? parseFloat(p[1]) / 100 : 0.4;
  }
  const hosts = new Map();
  const resize = new ResizeObserver((records) => {
    for (const record of records) {
      const e = hosts.get(record.target);
      if (e) measure(e);
      wake();
    }
  });
  const visibility = new IntersectionObserver((records) => {
    for (const record of records) {
      const e = hosts.get(record.target);
      if (e) e.visible = record.isIntersecting;
      wake();
    }
  });
  function sync() {
    const reusable = new Map();
    for (const [img, e] of entries)
      if (
        !img.isConnected ||
        img.dataset.portraitMode !== e.context ||
        img.dataset.artKey !== e.id
      ) {
        if (img.isConnected) {
          e.canvas.remove();
          e.host.classList.remove("motion-ready");
        }
        entries.delete(img);
        hosts.delete(e.host);
        resize.unobserve(e.host);
        visibility.unobserve(e.host);
        if (!reusable.has(e.slot)) reusable.set(e.slot, []);
        reusable.get(e.slot).push(e);
        // Orphan canvases stay in their detached parent for death-clone capture.
        // They have no observer/animation reference and are collected with that parent.
      }
    document.querySelectorAll("img[data-art-key]").forEach((img) => {
      const id = img.dataset.artKey;
      if (
        !MotionAssets[id] ||
        !CharacterCatalog[id]?.motion ||
        entries.has(img) ||
        img.closest(".death-ghost,.cast-card,.drag-ghost") ||
        !["board", "hero", "detail"].includes(img.dataset.portraitMode)
      )
        return;
      const host = img.parentElement;
      if (!host.matches(".card-art,.minion-art,.portrait-frame")) return;
      const context = img.dataset.portraitMode;
      const key = JSON.stringify([
        img.dataset.portraitInstance || "detail:" + id,
        id,
      ]);
      const slot = key + ":" + context,
        previous = reusable.get(slot)?.shift();
      const canvas = previous?.canvas || document.createElement("canvas");
      if (!previous) {
        canvas.width = 1;
        canvas.height = 1;
      }
      canvas.className = "portrait-motion";
      canvas.setAttribute("aria-hidden", "true");
      host.appendChild(canvas);
      const e = {
        id,
        key,
        slot,
        img,
        host,
        canvas,
        ctx: canvas.getContext("2d"),
        art: null,
        context,
        frozen: img.dataset.portraitState === "frozen",
        visible: previous?.visible ?? false,
        painted: previous?.painted ?? false,
        priority: 0,
      };
      entries.set(img, e);
      hosts.set(host, e);
      measure(e);
      resize.observe(host);
      visibility.observe(host);
      // Reuse the last completed bitmap before the browser paints the replacement DOM.
      if (e.painted && !disabled()) host.classList.add("motion-ready");
    });
    candidates = [...entries.values()];
    wake();
    const keys = new Set(candidates.map((e) => e.key));
    for (const key of phases.keys()) if (!keys.has(key)) phases.delete(key);
  }
  function paint(e, now) {
    if (e.canvas.width !== e.width || e.canvas.height !== e.height) {
      e.canvas.width = e.width;
      e.canvas.height = e.height;
      resizes++;
    }
    const w = e.canvas.width,
      h = e.canvas.height;
    let clock = phases.get(e.key);
    if (!clock) {
      clock = { t: now / 1000 + hash(e.key), last: now };
      phases.set(e.key, clock);
    }
    const elapsed = Math.max(0, Math.min(50, now - clock.last));
    if (!e.frozen) clock.t += elapsed / 1000;
    clock.last = now;
    const t = clock.t,
      [nativeW, nativeH] = CharacterCatalog[e.id].motion.size,
      scale = Math.max(w / nativeW, h / nativeH),
      dw = nativeW * scale,
      dh = nativeH * scale;
    const x = (w - dw) * e.px,
      y = (h - dh) * e.py;
    e.ctx.clearRect(0, 0, w, h);
    const draw = (i, dx = 0, dy = 0, angle = 0, alpha = 1) => {
      const c = e.ctx;
      c.save();
      c.globalAlpha = alpha;
      c.translate(w * 0.5 + dx, h * 0.78 + dy);
      c.rotate(angle);
      c.drawImage(e.art.images[i], x - w * 0.5, y - h * 0.78, dw, dh);
      c.restore();
    };
    const profile = CharacterCatalog[e.id].motion.rig;
    draw("background");
    if (profile.template === "wings") {
      const lift = Math.sin(t * profile.speed) * h * profile.lift,
        flap = Math.sin(t * profile.wingSpeed) * profile.turn;
      for (const [
        sx,
        offsetX,
        offsetY,
        direction,
        hingeX,
        hingeY,
      ] of profile.wings) {
        const c = e.ctx,
          hx = x + (hingeX + offsetX) * scale,
          hy = y + (hingeY + offsetY) * scale + lift;
        c.save();
        c.translate(hx, hy);
        c.rotate(flap * direction);
        c.drawImage(
          e.art.images.accent,
          sx,
          0,
          nativeW / 2,
          nativeH,
          x + (sx + offsetX) * scale - hx,
          y + offsetY * scale + lift - hy,
          dw / 2,
          dh,
        );
        c.restore();
      }
      draw("subject", 0, lift);
    } else if (profile.template === "whole-subject") {
      const swayPhase = t * profile.speed * 0.65;
      draw(
        "subject",
        Math.sin(swayPhase) * w * profile.sway,
        Math.sin(t * profile.speed) * h * profile.lift,
        Math.sin(swayPhase) * profile.turn,
      );
    } else if (["joint", "canopy"].includes(profile.template)) {
      const lift = Math.sin(t * profile.speed) * h * profile.lift;
      const sway = Math.sin(t * 0.7) * w * (profile.sway || 0);
      e.ctx.save();
      e.ctx.translate(w * 0.5, h * 0.78);
      e.ctx.rotate(Math.sin(t * 0.7) * 0.012);
      e.ctx.translate(-w * 0.5, -h * 0.78);
      draw("subject", sway, lift);
      // Head/crown turns around its authored joint; the torso remains anchored.
      const c = e.ctx,
        hx = x + profile.pivot[0] * scale,
        hy = y + profile.pivot[1] * scale + lift;
      const glance = Math.sin(t * 0.95);
      c.save();
      c.translate(hx + sway, hy);
      c.rotate(
        profile.turn *
          (profile.template === "canopy" ? Math.sin(t * 0.7) : glance),
      );
      const [sx, sy, sw, sh] = profile.crop || [0, 0, nativeW, nativeH];
      c.drawImage(
        e.art.images.accent,
        sx,
        sy,
        sw,
        sh,
        x - hx + (sx + profile.offset[0]) * scale,
        y + lift - hy + (sy + profile.offset[1]) * scale,
        sw * scale,
        sh * scale,
      );
      c.restore();
      e.ctx.restore();
    } else {
      const oracle = profile.template === "held-accent",
        dx = Math.sin(t * 0.85) * w * profile.sway,
        dy = Math.sin(t * profile.speed) * h * profile.lift,
        angle = Math.sin(t * 0.85) * profile.turn;
      draw("subject", dx, dy, angle);
      // Stars stay with the held instrument; ice stays anchored in the foreground.
      // Character movement, rather than changing opacity, carries the idle action.
      if (oracle) draw("accent", dx, dy, angle, 0.72);
      else draw("accent", -dx * 0.3, 0, 0, 0.9);
    }
    e.painted = true;
    e.host.classList.add("motion-ready");
    frames++;
  }
  function priority(e) {
    if (e.context === "detail") return 3;
    if (e.host.matches(":hover") || e.host.contains(document.activeElement))
      return 3;
    return e.context === "board" ? 2 : e.context === "hero" ? 1 : 0;
  }
  function tick(now) {
    raf = 0;
    active = 0;
    if (disabled()) return;
    const cap = mobile() ? 6 : 12,
      keep = new Set();
    let hasWork = false;
    candidates.forEach((e) => {
      e.priority = priority(e);
    });
    candidates.sort((a, b) => b.priority - a.priority);
    for (const e of candidates) {
      e.frozen = e.img.dataset.portraitState === "frozen";
      // A frozen bitmap needs neither a live slot nor decoded source layers.
      if (e.frozen && e.painted && e.priority > 0 && e.visible && e.sized) {
        e.host.classList.add("motion-ready");
        e.art = null;
        const clock = phases.get(e.key);
        if (clock) clock.last = now;
        continue;
      }
      const eligible = e.priority > 0 && e.visible && e.sized && active < cap;
      if (!eligible) {
        const clock = phases.get(e.key);
        if (clock) clock.last = now;
        // Unfocused collection/hand cards use their original art.
        if (!e.priority) {
          e.host.classList.remove("motion-ready");
          if (e.painted) {
            e.canvas.width = 1;
            e.canvas.height = 1;
            e.painted = false;
          }
        }
        e.art = null;
        continue;
      }
      keep.add(e.id);
      e.art = load(e.id);
      if (!e.art?.ready) {
        if (!e.art?.failed) hasWork = true;
        continue;
      }
      e.frozen = e.img.dataset.portraitState === "frozen";
      if (!e.frozen || !e.painted) {
        paint(e, now);
        hasWork = !e.frozen || hasWork;
      } else {
        e.host.classList.add("motion-ready");
        const clock = phases.get(e.key);
        if (clock) clock.last = now;
      }
      active++;
    }
    trimCache(keep);
    if (hasWork || pendingLoads) wake();
  }
  function preferenceChanged() {
    if (disabled()) {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      active = 0;
      // Hiding the tab keeps its last frame; reduced motion shows original art.
      if (!document.hidden)
        for (const e of entries.values())
          e.host.classList.remove("motion-ready");
    } else wake();
  }
  for (const type of ["pointerover", "pointerout", "focusin", "focusout"])
    document.addEventListener(type, wake, { passive: true });
  document.addEventListener("visibilitychange", preferenceChanged);
  motionPreference.addEventListener("change", preferenceChanged);
  new MutationObserver(sync).observe(document.getElementById("app"), {
    childList: true,
    subtree: true,
  });
  sync();
  wake();
  return Object.freeze({
    sync,
    configure(r, l) {
      reduced = !!r;
      low = !!l;
      preferenceChanged();
    },
    get active() {
      return active;
    },
    get tracked() {
      return entries.size;
    },
    get diagnostics() {
      return {
        frames,
        resizes,
        cached: assets.size,
        pendingLoads,
        cacheLimit: cacheLimit(),
        decodedBytes: [...assets.values()].reduce(
          (n, a) =>
            n +
            Object.values(a.images).reduce(
              (v, i) => v + i.naturalWidth * i.naturalHeight * 4,
              0,
            ),
          0,
        ),
        loadedIds: [...assets.keys()],
        active,
        cap: mobile() ? 6 : 12,
      };
    },
  });
})();
