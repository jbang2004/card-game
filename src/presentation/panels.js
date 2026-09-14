/* Shared noninteractive panel chrome. Content and game actions remain owned by
 * their screens; this module only labels a dialog root and its heading/footer
 * so the component sheet can lay them out.
 *
 * The old theme also injected four SVG corner brackets into every
 * `.crafted-panel`. The slate skin has no four-corner panel (design system
 * §1 rule 2), so the injection and the rules that hid it are gone. */
const EmberPanels = (() => {
  // Full-page dialogs own their own shell; only floating ones are labelled.
  const pages = new Set(["heroes", "library", "map", "contracts"]);
  function mount(box, type) {
    if (pages.has(type)) return;
    box.classList.add("crafted-panel");
    box.querySelector(":scope > .modal-heading")?.classList.add("panel-heading");
    box
      .querySelector(
        ":scope > .modal-footer,:scope > .reward-footer,:scope > .atelier-foot",
      )
      ?.classList.add("panel-actions");
  }
  return Object.freeze({ mount });
})();
