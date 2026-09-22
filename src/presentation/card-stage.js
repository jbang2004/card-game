/* One card taken out of a grid and held up: it flies from where it was, turns
 * over on the way, and lands enlarged beside a short label. This is the god
 * stage's form (design doc §12–13) for ordinary cards — it builds the same
 * `.god-stage` structure, so the skin's flight, flip, sheen, scrim and
 * reduced-motion rules apply unchanged. Presentation only: what the label's
 * buttons do is the caller's business. */
const EmberCardStage = (() => {
  const V = () => EmberViewport;
  const calm = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.body.classList.contains("reduced-motion");
  let open = null;

  function cardWidth() {
    const v = V();
    if (!v.mobile) return 340;
    return Math.round(
      v.portrait
        ? Math.min(300, Math.max(220, v.width * 0.62), Math.max(150, ((v.height - 275) * 5) / 7.4))
        : Math.min(300, Math.max(150, ((v.height - 48) * 5) / 7.4)),
    );
  }

  /* show({ card, cardHTML, from, label, bind, onClose })
   *   card      the card record (id and rarity choose the relief)
   *   cardHTML  markup of the card face
   *   from      element the card takes off from and returns to
   *   label     HTML placed in `.god-ritual` beside the card
   *   bind      (stage element, close) => wire the label's controls */
  function show({ card, cardHTML, from, label, bind, onClose }) {
    close(false);
    const v = V(),
      el = document.createElement("div");
    el.id = "card-stage";
    el.className = "god-stage card-stage god-stage-" + (v.portrait ? "flow" : "wide");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    el.setAttribute("aria-label", card.name);
    el.style.setProperty("--god-card-w", cardWidth() + "px");
    el.innerHTML = `<div class="god-scrim"></div><div class="god-shell"><div class="god-cards" data-count="1"><div class="god-card focused" data-cid="${card.id}" style="--stack:none"><div class="god-card-inner"><div class="god-card-face god-card-front">${cardHTML}</div><div class="god-card-face god-card-back"><i class="contract-back" aria-hidden="true"></i><i class="contract-seal" aria-hidden="true"></i></div></div></div></div><div class="god-ritual-holder"><div class="god-ritual">${label}</div></div></div>`;
    // Beside the folio dialogs on <body>, above them: those are fixed layers outside
    // the scaled #app, so the stage works in plain viewport pixels.
    document.body.append(el);
    const node = el.querySelector(".god-card");
    const state = (open = {
      el,
      node,
      flight: null,
      onClose,
      returnFocus: document.activeElement,
      key: (e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        close();
      },
    });
    el.querySelectorAll(".god-ritual > *").forEach((line, i) =>
      line.style.setProperty("--i", i),
    );

    /* FLIP, as on the god stage: the grid card's rect is the take-off pose. */
    const box = (node) => {
      const r = node.getBoundingClientRect();
      return r.width ? { x: r.left, y: r.top, w: r.width } : null;
    };
    const slot = from?.isConnected ? box(from) : null,
      here = box(el.querySelector(".god-cards"));
    if (slot && here && !calm()) {
      const scale = slot.w / here.w,
        dx = Math.round(slot.x - here.x),
        dy = Math.round(slot.y - here.y),
        len = Math.hypot(dx, dy) || 1,
        bend = Math.min(90, len * 0.18);
      state.flight = `translate(${dx}px, ${dy}px) scale(${scale.toFixed(3)})`;
      el.style.setProperty("--fly", state.flight + " rotate(-8deg)");
      el.style.setProperty(
        "--fly-mid",
        `translate(${Math.round(dx / 2 + (-dy / len) * bend)}px, ${Math.round(dy / 2 + (dx / len) * bend)}px) scale(${(((1 + scale) / 2) * 1.04).toFixed(3)}) rotate(-3deg)`,
      );
      el.classList.add("flying");
      setTimeout(() => el.classList.remove("flying"), 620);
    } else el.classList.add("instant");
    // Thickness from the start: the card turning over is where it shows. Its back is
    // seated that far behind the face (card-relief.css).
    const slab = EmberCardRelief.slab(node.querySelector(".god-card-front .card"));
    if (slab) {
      node.style.setProperty("--relief-depth", slab.depth + "px");
      node.style.setProperty("--relief-flange", slab.flange.toFixed(2) + "px");
    }

    el.querySelector(".god-scrim").onclick = () => close();
    document.addEventListener("keydown", state.key, true);

    /* The card in front leans toward the pointer; the relief face follows that
     * lean rather than adding one of its own. */
    const lean = (e) => {
      if (open !== state || calm() || e.pointerType === "touch") return;
      const r = node.getBoundingClientRect();
      if (!r.width) return;
      const clamp = (n) => Math.max(-1, Math.min(1, n)),
        px = clamp((e.clientX - (r.x + r.width / 2)) / (r.width / 2)),
        py = clamp((e.clientY - (r.y + r.height / 2)) / (r.height / 2));
      node.style.setProperty("--tilt-y", (px * 6).toFixed(2) + "deg");
      node.style.setProperty("--tilt-x", (-py * 6).toFixed(2) + "deg");
    };
    el.addEventListener("pointermove", lean, { passive: true });
    el.addEventListener(
      "pointerleave",
      () => {
        node.style.removeProperty("--tilt-x");
        node.style.removeProperty("--tilt-y");
        EmberCardRelief.rest();
      },
      { passive: true },
    );
    EmberCardRelief.mountCard(node.querySelector(".god-card-front .card"), {
      id: card.id,
      rarity: card.rarity,
      steer: "follow",
      tilt: false,
      anchor: node,
    });
    bind?.(el, close);
    el.querySelector(".god-ritual button:not([disabled])")?.focus?.({ preventScroll: true });
    return el;
  }

  function close(animate = true) {
    const state = open;
    if (!state) return;
    open = null;
    const { el, node } = state;
    document.removeEventListener("keydown", state.key, true);
    // The slab stays for the return flight (the card turns over again); the whole
    // stage is dropped after it.
    if (el.querySelector(".card-relief-canvas")) EmberCardRelief.release();
    const drop = () => {
      el.remove();
      if (state.returnFocus?.isConnected)
        state.returnFocus.focus({ preventScroll: true });
      state.onClose?.();
    };
    if (!animate) return drop();
    if (calm() || !state.flight) {
      el.classList.add("instant", "closing");
      return void setTimeout(drop, 210);
    }
    /* One timeline (§13.1): freeze the current pose, then send the card back to
     * its slot, turning over, while scrim and label leave with it. */
    const inner = node.querySelector(".god-card-inner");
    const poses = [getComputedStyle(node).transform, getComputedStyle(inner).transform];
    el.classList.remove("flying");
    node.style.transition = inner.style.transition = "none";
    node.style.transform = poses[0];
    inner.style.transform = poses[1];
    void el.offsetWidth;
    el.classList.add("closing");
    node.style.transition = inner.style.transition = "";
    node.style.transform = state.flight;
    inner.style.transform = "rotateY(180deg)";
    setTimeout(drop, 340);
  }

  return Object.freeze({
    show,
    close,
    get open() {
      return !!open;
    },
  });
})();
