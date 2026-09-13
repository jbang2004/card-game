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
  // Presentation test only: `?skin=slate` opts into the matte slate skin layer.
  const skin = /[?&]skin=([\w-]+)/.exec(globalThis.location?.search || "")?.[1];
  if (skin) document.documentElement.dataset.skin = skin;
  document.title = definition.title;
  document.documentElement.style.setProperty(
    "--scene-backdrop",
    `url("${art("backdrop")}")`,
  );
  for (const name of [
    "mulligan",
    "rewards",
    "result",
    "settings",
    "guide",
    "detail",
    "discover",
    "confirm",
  ])
    if (definition.art["reference" + name[0].toUpperCase() + name.slice(1)])
      document.documentElement.style.setProperty(
        `--reference-${name}`,
        `url("${art("reference" + name[0].toUpperCase() + name.slice(1))}")`,
      );
  for (const [name, role] of [
    ["victory-sigil", "victorySigil"],
    ["defeat", "defeatBackground"],
  ])
    if (definition.art[role])
      document.documentElement.style.setProperty(
        `--reference-${name}`,
        `url("${art(role)}")`,
      );
  if (definition.art.homePrimary)
    document.documentElement.style.setProperty(
      "--reference-primary",
      `url("${art("homePrimary")}")`,
    );
  for (const [name, role] of Object.entries({
    "card-frame": "polishCardFrame",
    "button-capsule": "polishButtonCapsule",
    "button-night": "polishButtonNight",
    "selection-panel": "polishSelectionPanel",
  })) {
    if (definition.art[role])
      document.documentElement.style.setProperty(
        `--polish-${name}`,
        `url("${art(role)}")`,
      );
  }
  return Object.freeze({
    art,
    image,
    bind,
    definition,
    hasArt: (role) => Object.hasOwn(definition.art, role),
  });
})();
