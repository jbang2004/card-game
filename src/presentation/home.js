/* One navigation highlight in layout coordinates, including on the scaled
 * desktop plane. This presentation module never dispatches game actions. */
(() => {
  "use strict";
  const nav = document.querySelector(".top-nav");
  const links = [...nav.querySelectorAll(".nav-link")];
  const modal = document.getElementById("modal");
  const light = document.createElement("span");
  light.className = "nav-light";
  light.setAttribute("aria-hidden", "true");
  nav.append(light);
  let hovered = null;
  let frame = 0;
  function selected() {
    const type = modal.dataset.type;
    return document.getElementById(
      type === "library"
        ? "collection-nav"
        : type === "help"
          ? "guide-nav"
          : "adventure-nav",
    );
  }
  function moveTo(link) {
    if (!link || !nav.offsetWidth) return;
    nav.style.setProperty("--nav-light-x", `${link.offsetLeft}px`);
    nav.style.setProperty("--nav-light-width", `${link.offsetWidth}px`);
  }
  function restore() {
    const focused = links.includes(document.activeElement)
      ? document.activeElement
      : null;
    moveTo(hovered || focused || selected());
  }
  function sync() {
    const current = selected();
    for (const link of links) {
      link.classList.toggle("active", link === current);
      if (link === current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
    restore();
  }
  for (const link of links) {
    link.addEventListener("pointerenter", () => {
      hovered = link;
      moveTo(link);
    });
    link.addEventListener("focus", () => moveTo(link));
  }
  nav.addEventListener("pointermove", (event) => {
    const link = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest(".nav-link");
    if (links.includes(link)) {
      hovered = link;
      moveTo(link);
    }
  });
  nav.addEventListener("pointerleave", () => {
    hovered = null;
    restore();
  });
  nav.addEventListener("pointercancel", () => {
    hovered = null;
    restore();
  });
  nav.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse") {
      hovered = null;
      schedule();
    }
  });
  function schedule() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      frame = 0;
      sync();
    });
  }
  nav.addEventListener("focusout", schedule);
  new ResizeObserver(schedule).observe(nav);
  new MutationObserver(() => {
    hovered = null;
    sync();
  }).observe(modal, {
    attributes: true,
    attributeFilter: ["data-type"],
  });
  sync();
})();

/* Shared optical navigation rail and action enhancement. The original
 * home rail above remains unchanged; every modal group owns just one light. */
(() => {
  const modal = document.getElementById("modal");
  const mounted = new Map();
  const groups =
    ".filter-type-group,.filter-mana-group,.settings-nav,.help-toc,.covenant-tabs,.hero-mode-cards";
  let scanFrame = 0;
  function mount(host) {
    if (mounted.has(host)) return;
    host.classList.add("selection-track");
    const light = document.createElement("span");
    light.className = "selection-light";
    light.style.transition = "none";
    light.setAttribute("aria-hidden", "true");
    host.append(light);
    let hover = null,
      frame = 0;
    const buttons = () =>
      [...host.querySelectorAll(":scope > button")].filter(
        (b) => b.offsetWidth,
      );
    const selected = () =>
      buttons().find((b) =>
        b.matches('.active,[aria-pressed="true"],[aria-current="true"]'),
      ) || buttons()[0];
    function sync() {
      frame = 0;
      if (!host.isConnected) return;
      const active = document.activeElement;
      const target =
        (hover?.isConnected && hover) ||
        (buttons().includes(active) && active) ||
        selected();
      if (!target || !host.offsetWidth) {
        light.hidden = true;
        return;
      }
      light.hidden = false;
      host.style.setProperty("--selection-x", `${target.offsetLeft}px`);
      host.style.setProperty(
        "--selection-y",
        `${target.offsetTop + target.offsetHeight - 1}px`,
      );
      host.style.setProperty("--selection-width", `${target.offsetWidth}px`);
      host.dataset.lightTarget =
        target.dataset.mana ??
        target.dataset.type ??
        target.dataset.section ??
        target.dataset.mode ??
        target.textContent.trim();
      if (light.style.transition)
        requestAnimationFrame(() => light.style.removeProperty("transition"));
    }
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };
    host.addEventListener("pointerover", (e) => {
      const b = e.target.closest("button");
      if (buttons().includes(b)) {
        hover = b;
        schedule();
      }
    });
    host.addEventListener("pointerleave", () => {
      hover = null;
      schedule();
    });
    host.addEventListener("pointercancel", () => {
      hover = null;
      schedule();
    });
    host.addEventListener("pointerup", (e) => {
      if (e.pointerType !== "mouse") {
        hover = null;
        schedule();
      }
    });
    host.addEventListener("focusin", schedule);
    host.addEventListener("focusout", schedule);
    const changes = new MutationObserver(schedule);
    changes.observe(host, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-pressed", "aria-current"],
    });
    const resize = new ResizeObserver(schedule);
    resize.observe(host);
    for (const b of buttons()) resize.observe(b);
    mounted.set(host, () => {
      cancelAnimationFrame(frame);
      changes.disconnect();
      resize.disconnect();
    });
    schedule();
  }
  const icons = {
    "deck-save": "compass-small",
    "deck-copy": "plus",
    "deck-play": "arrow",
    "hero-deck-btn": "cards",
    "hero-confirm": "arrow",
    "settings-done": "check",
    "help-done": "arrow",
    "reward-confirm": "arrow",
    "result-next": "arrow",
    "result-home": "return",
    "library-detail-back": "return",
    "library-detail-add": "plus",
    "cancel-confirm": "return",
    "ok-confirm": "compass-small",
    "mulligan-confirm": "check",
  };
  function scan() {
    scanFrame = 0;
    for (const [host, dispose] of mounted)
      if (!host.isConnected) {
        dispose();
        mounted.delete(host);
      }
    modal.querySelectorAll(groups).forEach(mount);
    EmberPanels.decorate(modal);
    for (const [id, icon] of Object.entries(icons)) {
      const b = document.getElementById(id);
      if (!b || !modal.contains(b)) continue;
      b.classList.add("crafted-action");
      if (!b.querySelector(":scope > .action-label")) {
        const label = document.createElement("span");
        label.className = "action-label";
        for (const node of [...b.childNodes])
          if (node.nodeName.toLowerCase() !== "svg") label.append(node);
        b.append(label);
      }
      b.toggleAttribute("data-icon-end", icon === "arrow");
      if (!b.querySelector(":scope > svg"))
        b.insertAdjacentHTML(
          icon === "arrow" ? "beforeend" : "afterbegin",
          EmberArt.icon(icon),
        );
    }
  }
  const schedule = () => {
    if (!scanFrame) scanFrame = requestAnimationFrame(scan);
  };
  new MutationObserver(schedule).observe(modal, {
    childList: true,
    subtree: true,
  });
  document.fonts.ready.then(schedule);
  scan();
})();
