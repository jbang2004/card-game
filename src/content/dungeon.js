/* The descent (下井): a run down the great shaft, act by act. Data only — EmberRun (rules/run.js) plays it, and the
 * words of every place and person are EmberStory's (content/story.js).
 *
 * An act is a small map: rows of two or three places, one of which the player walks into, then one of those it
 * leads to, down to the act's last row. A place is a fight (a small opponent), an elite (a named one, worth a
 * keepsake), an event (a choice, no battle), a chapel (rest), the basket (Amara's shop on a rope), a cache (a
 * treasure) or the act's boss. Battles start at full health; a lost battle costs one ember (火种) and the opponent
 * stays where it stood. With no embers left the run is over and the god's amber pulls its bearer back to the surface.
 *
 * The strength of an opponent comes from the tier its row names (1–9, the nine steps of the old expedition): a
 * rival (one of the preset decks) is cut down to the tier's health and deck size, a boss's health is scaled. */
const EmberDungeon = {
  embers: 3,
  // the class decks a run starts from (ten cards each: cheap, plain, the class's basics)
  starters: {
    mage: ["spark", "spark", "bolt", "bolt", "wisp", "frostbolt", "wisdom", "guard", "sentinel", "cleric"],
    paladin: ["squire", "squire", "shield", "blessing", "renew", "guard", "guard", "sentinel", "cleric", "treant"],
    ranger: ["wolf", "wolf", "archer", "archer", "battlecry", "spider", "assassin", "guard", "sentinel", "cleric"],
    morla: ["moonfox", "moonfox", "wolf", "graveoffering", "soultether", "soulguide", "spider", "guard", "sentinel", "cleric"],
  },
  // rival: its health and how many of its deck's cheapest cards it plays with; bossHp: × the boss's own health;
  // bossCards: a boss met at this tier plays only its cheapest cards (the first tiers' bosses are small decks)
  tiers: [
    { rival: { hp: 10, cards: 10 }, bossHp: 0.4, bossCards: 10 },
    { rival: { hp: 14, cards: 14 }, bossHp: 0.5, bossCards: 14 },
    { rival: { hp: 18, cards: 18 }, bossHp: 0.5, bossCards: 16 },
    { rival: { hp: 24, cards: 22 }, bossHp: 0.85, bossCards: 24 },
    { rival: { hp: 28, cards: 26 }, bossHp: 1 },
    { rival: { hp: 30, cards: 30 }, bossHp: 1.05 },
    { rival: { hp: 32, cards: 30 }, bossHp: 1.2 },
    { bossHp: 1.4 },
    { bossHp: 1.15 },
  ],
  /* The acts. rows: top to bottom; a row's slots are shuffled, each becomes one place. fights: the small opponents
   * ("rival" = any preset deck not yet met); elites: the named ones; bosses: one is drawn for the last row; mirror:
   * the bearer's own reflection (the boss made for this hero). A row may name the `event` its place holds (the others
   * are drawn from the act's). epilogue: entered only by a run that carries it (a bearer who has sealed the root
   * before — see EmberChronicle). */
  acts: [
    {
      id: "mine", scene: "act1",
      rows: [
        { tier: 1, slots: ["fight", "fight", "fight"] },
        { tier: 2, slots: ["fight", "fight", "elite"] },
        { slots: ["event", "event", "shop"] },
        { slots: ["chapel", "event"] },
        { tier: 3, slots: ["boss"] },
      ],
      fights: ["rival", "rival", "gleaner"],
      elites: ["fuse", "appraiser", "redscarf", "pawnbroker"],
      bosses: ["warden", "drill"],
      events: ["cavein", "ledger", "canary", "cardgame", "crossing"],
    },
    {
      id: "strata", scene: "act2",
      rows: [
        { tier: 4, slots: ["fight", "fight", "event"] },
        { tier: 4, slots: ["elite", "event", "cache"] },
        { tier: 5, slots: ["fight", "elite", "event"] },
        { slots: ["chapel", "shop"] },
        { tier: 5, slots: ["boss"] },
      ],
      fights: ["rival", "blacklung", "amberbody"],
      elites: ["clockmaker", "earlyriser", "oracle", "warden", "drill"],
      bosses: ["frost"],
      events: ["cracked", "mural", "jetlab", "sentry", "letters"],
    },
    {
      id: "roots", scene: "act3",
      rows: [
        { tier: 6, slots: ["fight", "fight", "event"] },
        { tier: 6, slots: ["elite", "event", "cache"] },
        { tier: 6, slots: ["mirror"] },
        { slots: ["chapel", "shop"] },
        { tier: 7, slots: ["boss"] },
      ],
      fights: ["rival", "mirrorlegion"],
      elites: ["queen", "moonkeeper"],
      bosses: ["ada"],
      events: ["campfire", "giant", "resin", "lamps"],
    },
    {
      id: "rootsea", scene: "act4",
      rows: [
        { slots: ["event"], event: "gathering" },
        { slots: ["event"], event: "watch" },
        { slots: ["chapel", "shop"] },
        { tier: 8, slots: ["boss"] },
      ],
      fights: [], elites: [], bosses: ["dragon"],
      events: ["gathering", "watch"],
    },
    {
      id: "otherside", scene: "act5", epilogue: true,
      rows: [
        { slots: ["event"] },
        { tier: 9, slots: ["boss"] },
      ],
      fights: [], elites: [], bosses: ["eve"],
      events: ["mirrortavern"],
    },
  ],
  // marks for a win: base + perTier × the tier won, more from a named opponent
  gold: { base: 10, perTier: 5, elite: 15, boss: 30 },
  prices: { common: 20, rare: 30, epic: 45, legendary: 70, relic: 90, remove: 25, removeStep: 10 },
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
  // rarity weights for bundle cards (legendaries are treasures only); epics grow likelier with the tier
  rarity: { common: 5, rare: 4, epic: 1, epicPerLevel: 0.35 },
  // treasures: weights of the three kinds
  treasure: { relic: 3, contract: 2, card: 2 },
  // a lost run leaves this many of its best cards down the shaft; the pawnbroker has them the next time
  pawned: 3,
};
if (typeof module !== "undefined") module.exports = EmberDungeon;
