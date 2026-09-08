/* Pure construction policy shared by content, engine and preparation UI. */
const EmberDeckRules = (() => {
  function classFor(data, heroId) {
    return data.heroes.find((h) => h.id === heroId)?.classId;
  }
  function canInclude(data, card, heroId) {
    const classId = classFor(data, heroId);
    return !!(
      classId &&
      card &&
      !card.token &&
      (card.class === "neutral" || card.class === classId)
    );
  }
  function copyLimit(data, card) {
    return data.deckRules.rarityCopies[card.rarity] ?? data.deckRules.maxCopies;
  }
  function check(data, deck, heroId = null) {
    const errors = [];
    if (!Array.isArray(deck))
      return { ok: false, errors: ["牌组必须是卡牌列表"] };
    if (heroId !== null && !classFor(data, heroId)) errors.push("未知英雄");
    if (deck.length !== data.deckRules.size)
      errors.push(
        `牌组需要 ${data.deckRules.size} 张牌（当前 ${deck.length} 张）`,
      );
    const counts = new Map();
    for (const id of deck) {
      const c =
        typeof id === "string" && Object.hasOwn(data.byId, id)
          ? data.byId[id]
          : null;
      if (!c || c.token) {
        errors.push(`不可组牌：${String(id)}`);
        continue;
      }
      if (heroId !== null && !canInclude(data, c, heroId))
        errors.push(`${c.name}不属于所选英雄职业`);
      const count = (counts.get(id) || 0) + 1;
      counts.set(id, count);
      if (count === copyLimit(data, c) + 1)
        errors.push(`${c.name}最多 ${copyLimit(data, c)} 张`);
    }
    return { ok: errors.length === 0, errors };
  }
  function summary(data) {
    const r = data.deckRules;
    const names = {
      common: "普通",
      rare: "稀有",
      epic: "史诗",
      legendary: "传说",
    };
    return (
      `${r.size} 张构筑 · 同名最多 ${r.maxCopies} 张` +
      Object.entries(r.rarityCopies)
        .map(([rarity, n]) => ` · ${names[rarity]}最多 ${n} 张`)
        .join("")
    );
  }
  return Object.freeze({ classFor, canInclude, copyLimit, check, summary });
})();
if (typeof module !== "undefined") module.exports = EmberDeckRules;
