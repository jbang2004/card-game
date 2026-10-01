/* Every card in the game is an amber block, and this module paints it.
 *
 *   still cards   A card anywhere in the page (hand, collection, rewards, drag ghost, flights, previews) is a DOM `.card` with
 *                 live text (cards.js). When it comes into view, one hidden renderer (EmberAmberVolume) draws it face-on at the
 *                 size it is shown, and the picture becomes the card's background (`--amber-img`). Pictures are cached by
 *                 card, displayed numbers and size, so a hand redraw costs nothing.
 *   live card     The one card the player is holding up to read, or the one on the stage, shows a live block: a second renderer
 *                 draws into a canvas inside that `.card`, turning with the pointer so the figure moves inside the resin.
 *
 * Presentation only. Without WebGL2 `html.amber-off` shows the DOM text on a plain amber plate (card-face.css). */
const EmberAmber = (() => {
  "use strict";
  const SIZES = [240, 320, 420, 560, 720]; // widths (device px) a still picture is rendered at
  const KEEP_LIVE = 4;
  const cache = new Map(); // key -> object URL
  const sizeOf = new WeakMap();
  let still = null, live = null;
  let liveCard = null, liveId = null, anchor = null, mounting = 0, liveRenderer = null, resizeWatch = null, touchOwner = null;
  let off = false;
  const stats = { status: "idle", id: null, steer: null, frames: 0, stills: 0 };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");

  function fail(error) {
    if (!off) {
      off = true;
      document.documentElement.classList.add("amber-off");
      stats.status = "fallback";
      console.warn("Amber cards fall back to the plain plate.", String(error?.message || error));
    }
    return null;
  }
  function renderer(kind) {
    if (off) return Promise.resolve(null);
    if (kind === "still") {
      still ??= EmberAmberVolume.create(document.createElement("canvas"), { keep: 40 }).then((r) => r || fail("WebGL2"), fail);
      return still;
    }
    if (!live) {
      const canvas = document.createElement("canvas");
      canvas.className = "amber-live-canvas";
      canvas.setAttribute("aria-hidden", "true");
      live = EmberAmberVolume.create(canvas, { live: true, keep: KEEP_LIVE }).then((r) => (r ? { r, canvas } : fail("WebGL2")), fail);
    }
    return live;
  }

  /* ------------------------------------------------------------- still cards */
  const num = (el) => {
    const t = el?.textContent.trim();
    return t === "" || t == null || isNaN(+t) ? undefined : +t;
  };
  function describe(card) {
    const over = {
      cost: num(card.querySelector(".card-cost .badge-value")),
      atk: num(card.querySelector(".stat.atk .stat-value")),
      hp: num(card.querySelector(".stat.hp .stat-value")),
    };
    for (const k of Object.keys(over)) if (over[k] === undefined) delete over[k];
    return { id: card.dataset.cardKey, over };
  }
  function bucket(card) {
    const r = card.getBoundingClientRect();
    const px = Math.max(r.width, card.offsetWidth * 0.8) * Math.min(2, window.devicePixelRatio || 1);
    return SIZES.find((s) => s >= px * 0.92) || SIZES[SIZES.length - 1];
  }
  const keyOf = (id, over, size) => `${id}|${over.cost ?? ""}|${over.atk ?? ""}|${over.hp ?? ""}|${size}`;
  function apply(card, key, url) {
    if (card.dataset.amberKey === key) return;
    card.style.setProperty("--amber-img", `url(${url})`);
    card.dataset.amberKey = key;
    card.classList.add("amber-ready");
  }
  const queue = [];
  let pumping = false;
  function request(card) {
    if (off || queue.includes(card)) return;
    // the cards in play are wanted first
    if (card.closest("#hand, #hand-card-lift, .drag-ghost, .card-motion-content, .card-preview")) queue.unshift(card);
    else queue.push(card);
    pump();
  }
  async function pump() {
    if (pumping) return;
    pumping = true;
    try {
      while (queue.length) {
        const card = queue.shift();
        if (!card.isConnected) continue;
        const { id, over } = describe(card);
        if (!id) continue;
        const size = bucket(card), key = keyOf(id, over, size);
        if (cache.has(key)) { apply(card, key, cache.get(key)); continue; }
        const r = await renderer("still");
        if (!r) { queue.length = 0; break; }
        let url;
        try {
          const canvas = await r.still(id, over, size);
          const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.92));
          if (!blob) continue;
          url = URL.createObjectURL(blob);
          cache.set(key, url);
          stats.stills++;
        } catch (error) {
          console.warn("Amber card skipped for " + id + ".", String(error?.message || error));
          continue;
        }
        if (card.isConnected) apply(card, key, url);
        // one render per frame keeps a page of cards from stalling input
        await new Promise((res) => requestAnimationFrame(res));
      }
    } finally {
      pumping = false;
    }
  }
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) { seen.unobserve(e.target); fit(e.target); }
    },
    { rootMargin: "240px" },
  );
  function fit(card) {
    const { id, over } = describe(card);
    if (!id) return;
    const size = bucket(card), key = keyOf(id, over, size);
    sizeOf.set(card, size);
    if (cache.has(key)) apply(card, key, cache.get(key));
    else request(card);
  }
  function watch(card) {
    if (card.dataset.amberWatch) return;
    card.dataset.amberWatch = "1";
    // a clone of a card that was live carries an empty canvas
    if (card !== liveCard) card.querySelectorAll(":scope > .amber-live-canvas").forEach((c) => c.remove());
    // a card already painted (a clone of one on screen) keeps its picture; one whose numbers changed repaints
    const { id, over } = describe(card);
    if (!id) return;
    const key = keyOf(id, over, sizeOf.get(card) || SIZES[1]);
    if (card.dataset.amberKey && card.dataset.amberKey.split("|").slice(0, 4).join("|") === key.split("|").slice(0, 4).join("|")) return;
    // a card that was drawn before and is shown again at its last size appears at once, with no plate in between
    const cached = SIZES.map((s) => keyOf(id, over, s)).find((k) => cache.has(k));
    if (cached) apply(card, cached, cache.get(cached));
    seen.observe(card);
  }
  function scan(root) {
    if (root.nodeType !== 1) return;
    if (root.matches?.(".card[data-card-key]")) watch(root);
    root.querySelectorAll?.(".card[data-card-key]").forEach(watch);
  }
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach(scan);
      // the game rewrites a card's numbers in place (a buff): paint it again
      if (r.type === "characterData" || (r.type === "childList" && r.target.closest?.(".card[data-amber-watch]"))) {
        const card = r.target.parentElement?.closest?.(".card[data-card-key]");
        if (card && card.dataset.amberWatch) { delete card.dataset.amberWatch; watch(card); }
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener("DOMContentLoaded", () => scan(document.body));
  if (document.body) scan(document.body);

  /* --------------------------------------------------------------- live card */
  const pointer = { x: 0, y: 0 };
  function steerTo(event) {
    pointer.x = event.clientX; pointer.y = event.clientY;
    if (!liveCard || !liveRenderer) return;
    if (event.pointerType === "touch") {
      const surface = anchor || liveCard;
      const reading = surface.closest("#hand-card-lift");
      const owns = touchOwner?.id === event.pointerId && (touchOwner.element.contains(surface) || surface.contains(touchOwner.element));
      if (!owns && !reading?.contains(event.target)) return;
    }
    const box = (anchor?.isConnected ? anchor : liveCard).getBoundingClientRect();
    if (!box.width) return;
    liveRenderer.aim(
      Math.max(-0.5, Math.min(0.5, (event.clientX - box.left - box.width / 2) / box.width)),
      Math.max(-0.5, Math.min(0.5, (event.clientY - box.top - box.height / 2) / box.height)),
    );
  }
  addEventListener("pointermove", steerTo, { passive: true });
  /* Show `card` (a `.card` element) as a live block. `options.id` is the card; `anchor` the element the pointer is measured
   * against (default the card). Resolves true when the block is on screen. */
  async function mountCard(card, options = {}) {
    if (!card || off) return false;
    const id = options.id || card.dataset.cardKey;
    // a surface made for reading owns a finger that rubs it
    const surface = card.closest(".mulligan-card,.discover-card,.card-detail-art,.card-preview[data-mode='pinned']");
    if (surface) bindTouch(surface);
    const ticket = ++mounting;
    const handle = await renderer("live");
    if (!handle || ticket !== mounting || !card.isConnected) return false;
    const { r, canvas } = handle;
    const { over } = describe(card);
    const px = Math.max(card.getBoundingClientRect().width, 96) * Math.min(2, window.devicePixelRatio || 1);
    const same = liveCard && liveId === id && liveRenderer === r && JSON.stringify(handle.over || {}) === JSON.stringify(over);
    liveRenderer = r;
    if (liveCard && liveCard !== card) liveCard.classList.remove("amber-live");
    liveCard = card; liveId = id; anchor = options.anchor || null;
    handle.over = over;
    if (!same) await r.show(id, over, px); else { r.resize(px); r.start(); }
    if (ticket !== mounting || !card.isConnected) return false;
    card.append(canvas);
    card.classList.add("amber-live");
    r.start();
    stats.status = "ready"; stats.id = id; stats.steer = options.steer || "pointer";
    (resizeWatch ||= new ResizeObserver(() => { if (liveCard && liveRenderer) liveRenderer.resize(Math.max(liveCard.getBoundingClientRect().width, 96) * Math.min(2, window.devicePixelRatio || 1)); })).disconnect();
    resizeWatch.observe(card);
    return true;
  }
  function release() {
    mounting++;
    resizeWatch?.disconnect();
    if (liveCard) {
      liveCard.classList.remove("amber-live");
      liveCard.querySelectorAll(":scope > .amber-live-canvas").forEach((c) => c.remove());
    }
    liveRenderer?.stop();
    liveCard = anchor = liveId = null;
    stats.status = "idle"; stats.id = null;
  }
  const rest = () => liveRenderer?.rest();
  /* Touch: only a surface made for reading owns a finger (hand rails and lifted hand cards keep their own gestures). */
  const touchSurfaces = new WeakSet();
  let rubbed = null;
  function bindTouch(element, onRest = null) {
    if (!element || touchSurfaces.has(element)) return;
    touchSurfaces.add(element);
    element.classList.add("card-touch-surface");
    let contact = null;
    element.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "touch" || !e.isPrimary) return;
      contact = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
      touchOwner = { element, id: e.pointerId };
      rubbed = null;
      steerTo(e);
    }, { passive: true });
    element.addEventListener("pointermove", (e) => {
      if (!contact || e.pointerId !== contact.id) return;
      contact.moved ||= Math.hypot(e.clientX - contact.x, e.clientY - contact.y) > 9;
    }, { passive: true });
    const end = (e) => {
      if (!contact || e.pointerId !== contact.id) return;
      if (contact.moved) rubbed = { element, until: performance.now() + 500 };
      contact = null;
      if (touchOwner?.element === element) touchOwner = null;
      rest();
      onRest?.();
    };
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) element.addEventListener(type, end, { passive: true });
  }
  // Rubbing a choice must not select it.
  window.addEventListener("click", (e) => {
    if (!rubbed || performance.now() > rubbed.until || !rubbed.element.contains(e.target)) return;
    rubbed = null;
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  /* A row of cards offered side by side (opening hand, discover): only the one the player attends to is live. */
  function attend(choices, describeChoice, initial = null) {
    let at = pointer;
    const show = (choice) => {
      const card = choice.querySelector(".card");
      if (!card || liveCard === card) return;
      mountCard(card, { ...describeChoice(choice), steer: "held" });
    };
    for (const choice of choices) {
      bindTouch(choice);
      choice.addEventListener("pointerenter", (event) => {
        const moved = event.clientX !== at.x || event.clientY !== at.y;
        at = { x: event.clientX, y: event.clientY };
        if (moved || !initial) show(choice);
      }, { passive: true });
      choice.addEventListener("pointerdown", () => show(choice), { passive: true });
      choice.addEventListener("focus", () => { if (choice.matches(":focus-visible")) show(choice); });
    }
    if (initial) show(initial);
  }
  /* Get the layers of the cards the player may pick up next ready while nothing else is happening. */
  function warm(ids) {
    if (off) return;
    (window.requestIdleCallback || setTimeout)(async () => {
      const h = await renderer("live");
      if (!h) return;
      for (const id of ids) await h.r.ensure(id).catch(() => {});
    });
  }
  return Object.freeze({
    mountCard,
    release,
    rest,
    bindTouch,
    attend,
    warm,
    paint: scan,
    /* Review hook: how a card's rules lay out on its face (see EmberAmberVolume `rules`). */
    rules: async (id) => (await renderer("still"))?.rules(id),
    holds: (element) => !!element && liveCard === element,
    /* The live block's current turn in radians ({ x: about the horizontal axis, y: about the vertical axis}). */
    angles: () => liveRenderer?.angles() ?? { x: 0, y: 0 },
    diagnostics: () => ({ ...stats, frames: liveRenderer?.perf().draws ?? 0, cached: cache.size }),
    /* Review hook: hold the live card at a pose (radians about the vertical and horizontal axes). */
    pose: (ay, ax) => liveRenderer?.setPose(ay ?? 0, ax ?? 0),
    ready: () => !off,
  });
})();
