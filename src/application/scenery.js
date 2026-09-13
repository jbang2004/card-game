/* VII: visual material bindings and non-destructive daylight choice.
 * No card definitions, gameplay probabilities or saved battle data are changed. */
(() => {
  "use strict";
  const E = Emberfall,
    $ = (s) => document.querySelector(s);
  const copy = EmberTheme.definition.copy;
  $(".lobby-copy>.eyebrow").textContent = copy.eyebrow;
  $(".lobby-chinese").textContent = copy.subtitle;
  $(".lobby-tagline").textContent = copy.tagline;
  $("#atelier-open").innerHTML = "原画档案<small>THE ART COLLECTION</small>";
  $(".board-empty").textContent = "故事的下一笔，由你来写";
  const button = document.createElement("button");
  button.id = "wind-time";
  button.type = "button";
  button.setAttribute("aria-label", "切换晴昼与暮色环境");
  button.title = "仅改变环境光，不影响对局";
  $(".top-actions").prepend(button);
  const key = "emberfall.world.v1";
  let isDusk = false;
  try {
    isDusk = JSON.parse(localStorage.getItem(key))?.dusk === true;
  } catch {}
  const sun =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19"/></svg>';
  const moon =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3A9 9 0 1 0 21 15.5 7.5 7.5 0 0 1 16.5 3Z"/><path d="M15 8.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" stroke-width="1" opacity=".38"/></svg>';
  function sync() {
    button.innerHTML =
      (AtelierWorld.dusk ? moon : sun) + (AtelierWorld.dusk ? "暮色" : "晴昼");
    button.setAttribute("aria-pressed", String(AtelierWorld.dusk));
    document.querySelectorAll(".wind-time-setting").forEach((b) => {
      b.textContent = AtelierWorld.dusk ? "暮色 · 切换晴昼" : "晴昼 · 切换暮色";
      b.setAttribute("aria-pressed", String(AtelierWorld.dusk));
    });
  }
  function toggle() {
    AtelierWorld.setDusk(!AtelierWorld.dusk);
    try {
      localStorage.setItem(key, JSON.stringify({ dusk: AtelierWorld.dusk }));
    } catch {}
    EmberFX.configure(E.settings.reduced, E.settings.low);
    sync();
  }
  button.onclick = toggle;
  AtelierWorld.setDusk(isDusk);
  sync();
  // A native-size alternative to the toolbar toggle is available in mobile settings.
  function enhanceSettings() {
    const box = $("#modal .settings-box");
    if (!box || box.querySelector(".wind-light-row")) return;
    const row = document.createElement("div");
    row.className = "setting-row wind-light-row";
    row.innerHTML =
      '<div><h3>酒馆时光</h3><p>晴昼或暮色，仅改变环境氛围</p></div><button type="button" class="wind-time-setting" aria-label="切换环境时光"></button>';
    const content =
      box.querySelector(".settings-options") ||
      box.querySelector(".modal-scroll");
    if (content) content.append(row);
    else box.insertBefore(row, box.querySelector(".modal-footer"));
    const fullscreen = document.createElement("div");
    fullscreen.className = "setting-row";
    fullscreen.innerHTML = '<div class="setting-copy"><h3>全屏游玩</h3><p>使用完整屏幕展示酒馆与战场</p></div><button type="button" class="ghost-btn small-btn" id="settings-fullscreen">切换全屏</button>';
    row.after(fullscreen);
    fullscreen.querySelector("button").onclick = () =>
      document.getElementById("fullscreen-btn").click();
    row.querySelector("button").onclick = toggle;
    sync();
  }
  new MutationObserver(enhanceSettings).observe(
    document.getElementById("modal"),
    { childList: true },
  );
  window.WindborneDiagnostics = Object.freeze({
    version: "0.14.0",
    theme: EmberTheme.definition.id,
    worldAssets: Object.keys(EmberTheme.definition.art).length,
    cardAssets: Object.keys(EmberData.byId).length,
    renderer: "DOM + Canvas",
    new3DMeshes: false,
  });
  E.toggleWorldTime = toggle;
})();
