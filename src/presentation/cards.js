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
  function ruleSize(c) {
    const length = [...String(c?.text ?? "")].length;
    if (length <= 18) return "short";
    if (length <= 42) return "standard";
    return "long";
  }
  /* The rarity band says type and class only; rarity is carried by the metal
   * itself and tribe is deliberately omitted — three terms do not fit. */
  function typeName(c) {
    return c.type === "spell" ? "法术" : c.type === "weapon" ? "武器" : "随从";
  }
  function bandLabel(c) {
    return `${typeName(c)} · ${EmberData.classNames[c.class] || "中立"}`;
  }
  /* The collection has no authored card number, so the catalogue position is
   * the number: collectibles first in authoring order, tokens after them. */
  let collectionIndex = null;
  function cardIndex(c) {
    if (!collectionIndex) {
      collectionIndex = Object.create(null);
      const all = (typeof EmberData !== "undefined" && EmberData.cards) || [];
      const collectible = all.filter((x) => !x.token);
      collectible.forEach((x, i) => (collectionIndex[x.id] = i + 1));
      all
        .filter((x) => x.token)
        .forEach(
          (x, i) => (collectionIndex[x.id] = collectible.length + i + 1),
        );
    }
    return String(collectionIndex[c.id] ?? 0).padStart(3, "0");
  }
  function cardHTML(c, opts = {}) {
    const stat = c.type === "minion" || c.type === "weapon",
      size = ruleSize(c),
      ward = c.type === "weapon",
      hp = opts.hp ?? c.hp,
      name = escape(c.name);
    return `<div data-card-key="${c.id}" data-class="${c.class}" data-rule-size="${size}" class="card school-${c.palette} art-painted ${c.rarity} ${c.type === "minion" ? "type-minion" : c.type}"><div class="card-inner"><div class="card-art"><img src="${A.card(c)}" alt="${name}" draggable="false" data-art-key="${artKeyForCard(c)}" style="${artStyleForCard(c, "card")}"></div><div class="card-title ${[...c.name].length > 6 ? "long" : ""}">${name}</div><div class="card-text"><span class="card-copy">${formatText(c.text)}</span></div><span class="card-index">EMBERFALL · No.${cardIndex(c)}</span><div class="card-type"><span>${bandLabel(c)}</span></div></div><div class="card-cost"><span class="gem" aria-hidden="true"></span><span class="badge-value">${opts.cost ?? c.cost}</span></div>${stat ? `<div class="stat atk">${A.statGem("blade")}<span class="stat-value">${opts.atk ?? c.atk}</span></div><div class="stat hp ${ward ? "ward" : ""} ${hp < c.hp ? "hurt" : ""}">${A.statGem(ward ? "shield" : "heart")}<span class="stat-value">${hp}</span></div>` : ""}</div>`;
  }
  return Object.freeze({
    escape,
    formatText,
    artKeyForCard,
    artStyleForCard,
    artStyleForHero,
    ruleSize,
    typeName,
    bandLabel,
    cardIndex,
    cardHTML,
  });
})();
