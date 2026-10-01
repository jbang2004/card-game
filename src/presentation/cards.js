/* Pure presentation: escaped card markup and artwork framing.
 * No game state, input handlers or persistence. Shared by all card contexts. */
const EmberCards = (() => {
  "use strict";
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
  /* Keywords carry a glyph when the face has a mask for them; the rest are
   * bolded and tinted by faction only. `data-kw` is the mask selector. */
  const keywordIcons = {
    战吼: "battlecry",
    亡语: "deathrattle",
    法术伤害: "spell",
    嘲讽: "taunt",
    圣盾: "divine",
    吸血: "lifesteal",
  };
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
      s = s.replaceAll(
        k,
        keywordIcons[k]
          ? `<b class="kw" data-kw="${keywordIcons[k]}">${k}</b>`
          : `<b class="kw">${k}</b>`,
      );
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
    });
  }
  function artStyleForHero(h, context = "hero") {
    const meta = AtelierArt.frameHero(h, context);
    return styleVars({
      "--art-pos": meta.pos || "50% 39%",
      "--art-scale": String(meta.scale ?? 1.13),
    });
  }
  /* The rarity band says type and class only; rarity is carried by the metal
   * itself and tribe is deliberately omitted — three terms do not fit. */
  function typeName(c) {
    return c.type === "spell" ? "法术" : c.type === "weapon" ? "武器" : "随从";
  }
  function bandLabel(c) {
    return `${typeName(c)} · ${EmberData.classNames[c.class] || "中立"}`;
  }
  /* The card is live DOM: name, cost, numbers and rules stay readable text (tests,
   * screen readers, copy-paste). Its picture is the amber block that EmberAmber
   * paints behind it (presentation/amber-cards.js), which draws the same text on
   * its own face; until that image is ready, or without WebGL2, the text shows
   * on a plain amber plate (card-face.css). */
  function cardHTML(c, opts = {}) {
    const stat = c.type === "minion" || c.type === "weapon",
      ward = c.type === "weapon",
      hp = opts.hp ?? c.hp,
      name = escape(c.name);
    return `<div data-card-key="${c.id}" data-class="${c.class}" class="card amber-card school-${c.palette} ${c.rarity} ${c.type === "minion" ? "type-minion" : c.type}" role="img" aria-label="${name}"><div class="card-cost"><span class="badge-value">${opts.cost ?? c.cost}</span></div><div class="card-title"><span class="card-title-value">${name}</span></div><div class="card-text"><span class="card-copy">${formatText(c.text)}</span></div><div class="card-type"><span>${bandLabel(c)}</span></div>${stat ? `<div class="stat atk"><span class="stat-value">${opts.atk ?? c.atk}</span></div><div class="stat hp ${ward ? "ward" : ""} ${hp < c.hp ? "hurt" : ""}"><span class="stat-value">${hp}</span></div>` : ""}</div>`;
  }
  return Object.freeze({
    escape,
    formatText,
    artKeyForCard,
    artStyleForCard,
    artStyleForHero,
    typeName,
    bandLabel,
    cardHTML,
  });
})();
