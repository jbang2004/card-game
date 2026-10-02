/* Artwork crop metadata. Does not patch another module or infer character roles. */
const AtelierArt = (() => {
  const focuses = Object.freeze(
    Object.fromEntries(
      Object.entries(CharacterCatalog).map(([id, c]) => [id, c.focus]),
    ),
  );
  function framing(key, context = "card", focus = focuses[key] ?? 25) {
    const pos = focus;
    return {
      pos: `50% ${context === "card" || context === "option" ? pos : Math.max(12, pos - 3)}%`,
      scale: context === "card" ? 1.025 : context === "option" ? 1.015 : 1.04,
    };
  }
  function frameHero(h, context = "hero") {
    return framing(h.portraitId, context, EmberPortraits[h.portraitId].focus);
  }
  return Object.freeze({
    framing,
    frameHero,
    focuses,
    paintedCards: EmberData.cards,
  });
})();
