/* UI integration. The workshop is display-only: it cannot spend resources,
 * change deck order, advance a boss or overwrite a save. */
(() => {
  "use strict";
  const E = window.Emberfall,
    A = EmberArt,
    $ = (id) => document.getElementById(id);
  const b = document.createElement("button");
  b.className = "atelier-open";
  b.id = "atelier-open";
  b.innerHTML = "战场画廊<small>THE ARTISAN’S ATELIER</small>";
  $("lobby").appendChild(b);
  function showAtelier() {
    if (EmberFX.busy) return;
    const scenes = EmberData.bosses.map((b) => ({
      name: b.name,
      chapter: b.title,
      art: EmberTheme.art(EmberThemeDefinition.encounters[b.id]),
    }));
    E.showModal(
      `<section class="modal-box atelier-box"><div class="modal-heading"><div class="eyebrow">EMBERFALL · THE ARTISAN’S ATELIER</div><h2>战场画廊</h2><p>从灰烬城门到月影神殿，探索六处冒险战场。</p></div><div class="atelier-architecture">${scenes.map((scene) => `<article class="atelier-vignette crafted-panel"><img src="${scene.art}" alt="${scene.name}的战场" draggable="false"><h3>${scene.name}</h3><p>${scene.chapter}</p></article>`).join("")}</div><div class="atelier-foot"><p>探索首领领地，回望你的冒险旅程。</p><button class="gold-btn small-btn" id="atelier-done">回到酒馆 ${A.icon("arrow")}</button></div></section>`,
      "atelier",
    );
    $("atelier-done").onclick = () => E.closeModal();
  }
  b.onclick = showAtelier;
  E.showAtelier = showAtelier;
  // The opening cabinet uses two illustrations actually adapted in this edition.
  // Expose diagnostics without adding a permanent debug panel to the game.
  window.AtelierDiagnostics = {
    version: "0.14.0",
    assets: Object.keys(EmberThemeDefinition.art).length,
    paintedCards: AtelierArt.paintedCards.length,
    scenes: 6,
    frames: 0,
    layout: "1600x940",
    input: "live DOM",
    renderer: "Canvas 2D",
  };
})();
