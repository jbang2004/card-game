/* Marks the navigation link that matches the open dialog. The slate skin draws
 * the indicator with `.nav-link.active::after`; the old theme's travelling
 * `.nav-light` band is gone. This presentation module never dispatches game
 * actions. */
(() => {
  "use strict";
  const nav = document.querySelector(".top-nav");
  const links = [...nav.querySelectorAll(".nav-link")];
  const modal = document.getElementById("modal");
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
  function sync() {
    const current = selected();
    for (const link of links) {
      link.classList.toggle("active", link === current);
      if (link === current) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  }
  new MutationObserver(sync).observe(modal, {
    attributes: true,
    attributeFilter: ["data-type"],
  });
  sync();
})();

/* Action enhancement: the named dialog buttons get their shared icon and a
 * wrapped label so the component sheet can lay them out. The old theme's
 * per-group `.selection-light` rail is gone; every selector group now shows its
 * own selection with `.active::after`. */
(() => {
  const modal = document.getElementById("modal");
  let scanFrame = 0;
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
