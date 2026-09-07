/* Content composition root. Definitions are immutable; instances live in Game. */
const EmberData = (() => {
  const R =
    typeof EmberRules !== "undefined"
      ? EmberRules
      : require("./rules/effects.js");
  const definitions =
    typeof EmberCardDefinitions !== "undefined"
      ? EmberCardDefinitions
      : require("./content/cards.js");
  const campaign =
    typeof EmberCampaign !== "undefined"
      ? EmberCampaign
      : require("./content/campaign.js");
  function create(input = definitions, world = campaign) {
    const cards = input.map((c) => ({
      tags: [],
      onPlay: [],
      onDeath: [],
      ...structuredClone(c),
    }));
    const { heroes, bosses, relics, kw } = structuredClone(world),
      byId = {};
    const cardFields = new Set([
      "id",
      "name",
      "cost",
      "atk",
      "hp",
      "art",
      "palette",
      "rarity",
      "type",
      "tags",
      "target",
      "token",
      "onPlay",
      "onDeath",
      "secret",
    ]);
    for (const c of cards) {
      for (const key of Object.keys(c))
        if (!cardFields.has(key))
          throw Error(c.id + ": Unknown card field " + key);
      if (!/^[a-z][a-z0-9_]*$/.test(c.id) || byId[c.id])
        throw Error("Invalid or duplicate card ID: " + c.id);
      if (
        !["minion", "spell", "weapon"].includes(c.type) ||
        !Number.isInteger(c.cost) ||
        c.cost < 0
      )
        throw Error(c.id + ": Invalid type/cost");
      if (
        !c.name ||
        !c.art ||
        !c.palette ||
        !["common", "rare", "epic", "legendary"].includes(c.rarity)
      )
        throw Error(c.id + ": Incomplete metadata");
      if (
        c.type !== "spell" &&
        (!Number.isInteger(c.atk) ||
          c.atk < 0 ||
          !Number.isInteger(c.hp) ||
          c.hp < 1)
      )
        throw Error(c.id + ": Invalid stats");
      if (!Array.isArray(c.tags) || c.tags.some((t) => !kw[t]))
        throw Error(c.id + ": Invalid keywords");
      if (
        c.target &&
        !["enemy", "enemyMinion", "friendlyMinion", "minion"].includes(c.target)
      )
        throw Error(c.id + ": Invalid target");
      for (const k of ["battle", "death", "effect", "value", "text"])
        if (k in c) throw Error(c.id + ": Obsolete field " + k);
      if (c.type !== "minion" && c.onDeath.length)
        throw Error(c.id + ": Only minions support onDeath");
      if (c.type === "weapon" && c.onPlay.length)
        throw Error(c.id + ": Weapon onPlay is not supported");
      byId[c.id] = c;
    }
    const db = { ...byId, $kw: kw };
    for (const c of cards) {
      R.validateEffects(c.onPlay, db, c.id);
      R.validateEffects(c.onDeath, db, c.id);
      if (c.onPlay.some((e) => e.to === "selected") && !c.target)
        throw Error(c.id + ": Selected effect requires a target");
      if (
        c.onPlay.some((e) => e.type === "secret") &&
        (!c.secret ||
          c.secret.when !== "beforeHeroAttack" ||
          byId[c.secret.summon]?.type !== "minion")
      )
        throw Error(c.id + ": Invalid secret");
      if (c.onDeath.some((e) => e.to === "selected"))
        throw Error(c.id + ": Death effects cannot require player targeting");
      if (
        c.onPlay.some(
          (e) =>
            e.to === "selected" &&
            ["buff", "grant", "silence", "transform", "destroy"].includes(
              e.type,
            ),
        ) &&
        !["enemyMinion", "friendlyMinion", "minion"].includes(c.target)
      )
        throw Error(c.id + ": Effect requires a minion target");
      if (Boolean(c.secret) !== c.onPlay.some((e) => e.type === "secret"))
        throw Error(c.id + ": Secret definition/effect mismatch");
      c.text = R.text(c, db);
    }
    for (const h of [...heroes, ...bosses]) {
      if (!byId[h.portraitId]) throw Error(h.id + ": Invalid portrait ID");
      if (!Number.isInteger(h.powerCost) || h.powerCost < 0)
        throw Error(h.id + ": Invalid power cost");
      if (h.deck.some((id) => !byId[id] || byId[id].token))
        throw Error(h.id + ": Invalid deck reference");
      R.validateEffects(h.powerEffects, db, h.id);
      if (h.phaseEffects) R.validateEffects(h.phaseEffects, db, h.id);
    }
    for (const r of relics)
      for (const key of ["onStart", "onTurn"])
        if (r[key]) R.validateEffects(r[key], db, r.id);
    const describe = (ops, c = {}) =>
      R.text(
        { tags: [], type: "spell", onPlay: ops || [], onDeath: [], ...c },
        db,
      );
    for (const h of [...heroes, ...bosses]) {
      h.powerText =
        h.powerCost +
        " 法力：" +
        describe(h.powerEffects, { target: h.target });
      if (h.phaseEffects) h.phaseText = "半血：" + describe(h.phaseEffects);
    }
    for (const r of relics) {
      r.text = r.maxHealth
        ? `每场战斗，英雄最大生命值 +${r.maxHealth}。`
        : r.spellDamage
          ? `你的伤害法术额外造成 ${r.spellDamage} 点伤害。`
          : r.startingMana
            ? `每场战斗的起始法力水晶上限 +${r.startingMana}。`
            : r.onTurn
              ? "你的每个回合开始时，" + describe(r.onTurn)
              : "每场战斗开始时，" + describe(r.onStart);
    }
    return R.freeze({ cards, byId, heroes, bosses, relics, kw });
  }
  return Object.freeze({ ...create(), create });
})();
if (typeof module !== "undefined") module.exports = EmberData;
