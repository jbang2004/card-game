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
  document.title = definition.title;
  document.documentElement.style.setProperty(
    "--scene-backdrop",
    `url("${art("backdrop")}")`,
  );
  return Object.freeze({
    art,
    image,
    bind,
    definition,
    hasArt: (role) => Object.hasOwn(definition.art, role),
  });
})();
