/* The expedition (地下城远征): a run of eight levels. Data only — EmberRun (rules/run.js) plays it.
 *
 * A run starts from a small class deck and grows it: after each win the player takes one of three themed bundles of
 * three cards; after levels 1, 3, 5 and 7 one of three treasures (a relic, a covenant, a legendary or epic card); the
 * tavern opens after levels 2, 4 and 6 (buy cards, strike one from the deck). Every battle starts at full health; one
 * loss ends the run. At each level two opponents are offered and the player picks one: a rival (one of the preset
 * decks, cut down and weakened for the early levels) or a boss (its health scaled by the level). */
const EmberDungeon = {
  levels: 8,
  // the class decks a run starts from (ten cards each: cheap, plain, the class's basics)
  starters: {
    mage: ["spark", "spark", "bolt", "bolt", "wisp", "frostbolt", "wisdom", "guard", "sentinel", "cleric"],
    paladin: ["squire", "squire", "shield", "blessing", "renew", "guard", "guard", "sentinel", "cleric", "treant"],
    ranger: ["wolf", "wolf", "archer", "archer", "battlecry", "spider", "assassin", "guard", "sentinel", "cleric"],
    morla: ["moonfox", "moonfox", "wolf", "graveoffering", "soultether", "soulguide", "spider", "guard", "sentinel", "cleric"],
  },
  // who can be met at each level: "rival" = a preset deck (EmberCampaign.archetypes), otherwise a boss id.
  // rival: its health and how many of its deck's cheapest cards it plays with; bossHp: × the boss's own health
  stages: [
    { pool: ["rival"], rival: { hp: 10, cards: 10 } },
    { pool: ["rival"], rival: { hp: 14, cards: 14 } },
    { pool: ["rival", "warden", "queen"], rival: { hp: 18, cards: 18 }, bossHp: 0.6 },
    { pool: ["rival", "warden", "queen"], rival: { hp: 21, cards: 22 }, bossHp: 0.65 },
    { pool: ["rival", "queen", "oracle", "frost"], rival: { hp: 24, cards: 26 }, bossHp: 0.7 },
    { pool: ["rival", "oracle", "frost", "moonkeeper"], rival: { hp: 27, cards: 30 }, bossHp: 0.8 },
    { pool: ["oracle", "frost", "moonkeeper"], bossHp: 0.9 },
    { pool: ["dragon"], bossHp: 1 },
  ],
  treasureAfter: [1, 3, 5, 7],
  tavernAfter: [2, 4, 6],
  // gold for a win: base + perLevel × the level won
  gold: { base: 10, perLevel: 5 },
  prices: { common: 20, rare: 30, epic: 45, legendary: 70, remove: 25, removeStep: 10 },
  // the bundles: three cards that share a theme (a theme is offered only when the class has three cards for it)
  themes: [
    { id: "early", name: "先发制人", text: "低费随从与法术，抢占先机。", maxCost: 2 },
    { id: "spells", name: "法术秘典", text: "以法术控场与收割。", type: "spell" },
    { id: "guard", name: "坚守壁垒", text: "嘲讽与高生命，稳住战线。", tags: ["taunt"] },
    { id: "swift", name: "迅捷突袭", text: "突袭、冲锋、风怒与潜行。", tags: ["rush", "charge", "windfury", "stealth"] },
    { id: "light", name: "圣光庇护", text: "圣盾、吸血与重生。", tags: ["shield", "lifesteal", "reborn"] },
    { id: "beast", name: "野兽之群", text: "野兽种族协同。", tribe: "beast" },
    { id: "undead", name: "亡者回响", text: "亡灵与亡语。", tribe: "undead" },
    { id: "moon", name: "月影神契", text: "灵魂与月影契约。", set: "moon_covenant" },
    { id: "oaths", name: "酒馆誓约", text: "奥秘、反制与整备。", set: "tavern_oaths" },
    { id: "pantheon", name: "众神之路", text: "献祭神祇的仪式牌。", set: "pantheon" },
    { id: "giants", name: "巨物来临", text: "五费以上的大家伙。", minCost: 5 },
  ],
  // rarity weights for bundle cards (legendaries are treasures only); epics grow likelier with the level
  rarity: { common: 5, rare: 4, epic: 1, epicPerLevel: 0.35 },
  // treasures: weights of the three kinds
  treasure: { relic: 3, contract: 2, card: 2 },
};
if (typeof module !== "undefined") module.exports = EmberDungeon;
