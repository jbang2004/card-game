/* Artwork crop metadata. Does not patch another module or infer character roles. */
const AtelierArt = (() => {
  const focuses = Object.freeze({
    spark: 12,
    squire: 14,
    wolf: 20,
    archer: 21,
    guard: 21,
    oracle: 24,
    wisp: 27,
    spider: 14,
    sentinel: 29,
    assassin: 17,
    cleric: 21,
    berserker: 24,
    golem: 13,
    leech: 25,
    treant: 26,
    phoenix: 26,
    rider: 19,
    necromancer: 17,
    paladin: 12,
    titan: 16,
    huntress: 22,
    dragon: 23,
    reaper: 23,
    colossus: 16,
    solaris: 28,
    nyx: 19,
    ashdragon: 20,
    frostking: 24,
    bolt: 15,
    frostbolt: 17,
    fireball: 20,
    nova: 51,
    storm: 52,
    wisdom: 49,
    blessing: 32,
    renew: 27,
    execute: 30,
    silence: 46,
    rally: 24,
    wolves: 42,
    shield: 26,
    lifedrain: 37,
    dagger: 42,
    sunblade: 41,
    polymorph: 52,
    discovery: 24,
    ambush: 31,
    battlecry: 44,
    coin: 56,
    pup: 40,
    spiritwolf: 33,
    skeleton: 29,
    stone: 19,
    sheep: 45,
    recruit: 25,
    thorn: 37,
  });
  function framing(key, context = "card") {
    const pos = focuses[key] ?? 25;
    return {
      pos: `50% ${context === "card" || context === "option" ? pos : Math.max(12, pos - 3)}%`,
      scale: context === "card" ? 1.025 : context === "option" ? 1.015 : 1.04,
    };
  }
  function frameHero(h, context = "hero") {
    return framing(h.portraitId, context);
  }
  return Object.freeze({
    framing,
    frameHero,
    focuses,
    paintedCards: EmberData.cards,
  });
})();
