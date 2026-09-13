/* Lobby state follows the shared application view; battle scenery has no tavern hotspots. */
(() => {
  document.getElementById("app").classList.toggle("lobby-view", !Emberfall.inBattle);
})();
