/* Resolves an edition's semantic assets. UI modules depend on these roles, never
 * asset paths. A theme replacement edits the definition + component tokens. */
const EmberTheme = (() => {
  "use strict";
  const definition = EmberThemeDefinition;
  const cache = new Map();
  function art(role) {
    const src = definition.art[role];
    if (!src) throw new Error("Theme artwork missing: " + role);
    return src;
  }
  function image(role) {
    if (!cache.has(role)) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () =>
        window.dispatchEvent(new CustomEvent("ember:theme-art"));
      img.onerror = () => {
        document.documentElement.dataset.artError = role;
        console.error("Theme image could not load:", role);
      };
      img.src = art(role);
      cache.set(role, img);
    }
    return cache.get(role);
  }
  function bind(root = document) {
    for (const el of root.querySelectorAll("[data-theme-art]")) {
      const role = el.dataset.themeArt;
      image(role);
      if (el.tagName === "IMG") el.src = art(role);
      else el.style.setProperty("--scene-art", `url("${art(role)}")`);
    }
  }
  document.documentElement.dataset.theme = definition.id;
  // The matte slate skin (磨砂青岩) is the only presentation layer. `data-skin`
  // is NOT a switch any more: it is the namespace the whole skin is written
  // against (`html[data-skin="slate"] …`), so it is written unconditionally and
  // must stay on the root element.
  document.documentElement.dataset.skin = "slate";
  document.title = definition.title;
  document.documentElement.style.setProperty(
    "--scene-backdrop",
    `url("${art("backdrop")}")`,
  );
  // The only bitmap the dialog layer still consumes through a custom property:
  // the victory result seal, laid over a hidden SVG fallback.
  if (definition.art.victorySigil)
    document.documentElement.style.setProperty(
      "--victory-sigil",
      `url("${art("victorySigil")}")`,
    );
  return Object.freeze({
    art,
    image,
    bind,
    definition,
    hasArt: (role) => Object.hasOwn(definition.art, role),
  });
})();
