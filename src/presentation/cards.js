/* Pure presentation: escaped card markup and artwork framing.
 * No game state, input handlers or persistence. Shared by all card contexts. */
const EmberCards = (() => {
  "use strict";
  const A = EmberArt;
  const escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function formatText(text) {
    let s = escape(text);
    for (const k of [
      "战吼",
      "亡语",
      "法术伤害",
      "嘲讽",
      "圣盾",
      "突袭",
      "冲锋",
      "吸血",
      "剧毒",
      "风怒",
      "潜行",
      "复生",
      "冻结",
      "沉默",
      "发现",
      "奥秘",
    ])
      s = s.replaceAll(k, "<b>" + k + "</b>");
    return s;
  }
  function artKeyForCard(c) {
    return c.id;
  }
  function artVars(key, context) {
    return AtelierArt.framing(key, context);
  }
  function styleVars(obj) {
    return Object.entries(obj)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  }
  function artStyleForCard(c, context = "card") {
    const meta = artVars(artKeyForCard(c), context);
    return styleVars({
      "--art-pos": meta.pos || "50% 42%",
      "--art-scale": String(meta.scale ?? 1.08),
    });
  }
  function artStyleForHero(h, context = "hero") {
    const meta = AtelierArt.frameHero(h, context);
    return styleVars({
      "--art-pos": meta.pos || "50% 39%",
      "--art-scale": String(meta.scale ?? 1.13),
    });
  }
  function cardHTML(c, opts = {}) {
    const stat = c.type === "minion" || c.type === "weapon",
      painted = true;
    return `<div data-card-key="${c.id}" data-class="${c.class}" class="card school-${c.palette} ${painted ? "art-painted" : "art-original"} ${c.text.length > 43 ? "dense" : ""} ${c.rarity} ${c.type === "minion" ? "type-minion" : c.type}"><div class="card-inner"><div class="card-art"><img src="${A.card(c)}" alt="${escape(c.name)}" draggable="false" data-art-key="${artKeyForCard(c)}" data-portrait-mode="static" style="${artStyleForCard(c, "card")}"></div><div class="card-title ${c.name.length > 7 ? "long" : ""}">${c.name}</div><div class="card-text">${formatText(c.text)}</div><div class="card-type">${c.type === "spell" ? "法 术" : c.type === "weapon" ? "武 器" : "随 从"} · ${EmberData.classNames[c.class] || "中立"}${c.tribe ? " · " + EmberData.tribeNames[c.tribe] : ""}${c.rarity === "legendary" ? " · 传说" : ""}</div></div><div class="card-cost"><span class="badge-glyph" aria-hidden="true">${A.icon("gem")}</span><span class="badge-value">${opts.cost ?? c.cost}</span></div><div class="card-rarity"></div><div class="card-decoration" aria-hidden="true"></div><span class="card-class-seal" aria-hidden="true">${A.icon({ mage: "star", paladin: "sun", ranger: "hunt", moon: "moon" }[c.class] || "gem")}</span>${stat ? `<div class="stat atk"><span class="stat-glyph" aria-hidden="true">${A.icon("sword")}</span><span class="stat-value">${opts.atk ?? c.atk}</span></div><div class="stat hp ${(opts.hp ?? c.hp) < c.hp ? "hurt" : ""}"><span class="stat-glyph" aria-hidden="true">${A.icon(c.type === "weapon" ? "shield" : "heart")}</span><span class="stat-value">${opts.hp ?? c.hp}</span></div>` : ""}</div>`;
  }
  return Object.freeze({
    escape,
    formatText,
    artKeyForCard,
    artStyleForCard,
    artStyleForHero,
    cardHTML,
  });
})();
