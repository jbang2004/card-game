/* Shared noninteractive panel chrome. Content and game actions remain owned by
 * their screens; every contained surface uses the same four SVG corners. */
const EmberPanels = (() => {
  const pages = new Set(["heroes", "library", "map", "contracts"]);
  const corner =
    '<svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M1 35V10L10 1H35M5 29V12L12 5H29" stroke="#a6bfd2" stroke-width=".75"/><path d="M3 24Q4 5 24 3M6 6 13 9 9 13Z" stroke="#dfdccb" stroke-width=".85"/><path d="m9 9 9 9M2 2 6 6" stroke="#eaf4ff" stroke-width=".6"/></svg>';
  function decorate(root) {
    const panels = [...root.querySelectorAll(".crafted-panel")];
    if (root.matches?.(".crafted-panel")) panels.unshift(root);
    for (const panel of panels) {
      if (panel.querySelector(":scope > .panel-corner-trim")) continue;
      const trim = document.createElement("span");
      trim.className = "panel-corner-trim";
      trim.setAttribute("aria-hidden", "true");
      trim.innerHTML = corner.repeat(4);
      panel.append(trim);
    }
  }
  function mount(box, type) {
    box.classList.add(pages.has(type) ? "folio-page" : "crafted-panel");
    if (!pages.has(type)) {
      box
        .querySelector(":scope > .modal-heading")
        ?.classList.add("panel-heading");
      box
        .querySelector(
          ":scope > .modal-footer,:scope > .reward-footer,:scope > .atelier-foot",
        )
        ?.classList.add("panel-actions");
    }
    decorate(box);
  }
  decorate(document);
  return Object.freeze({ mount, decorate });
})();
