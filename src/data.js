/* Content composition root. Definitions are immutable; instances live in Game. */
const EmberData = (() => {
  const MAX_CARD_RULE_CHARS = 52;
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
  const Decks =
    typeof EmberDeckRules !== "undefined"
      ? EmberDeckRules
      : require("./rules/decks.js");
  const Schema =
    typeof EmberCatalog !== "undefined"
      ? EmberCatalog
      : require("./rules/catalog.js");
  const Contracts =
    typeof EmberContracts !== "undefined"
      ? EmberContracts
      : require("./rules/contracts.js");
  function create(input = definitions, world = campaign) {
    Schema.validate(world);
    const cards = input.map((c) => ({
      tags: [],
      class: "neutral",
      onPlay: [],
      onDeath: [],
      ...structuredClone(c),
    }));
    const {
        heroes,
        bosses,
        relics,
        kw,
        archetypes,
        classes,
        tribes,
        deckRules,
      } = structuredClone(world),
      byId = Object.create(null);
    const cardFields = new Set([
      "id",
      "class",
      "tribe",
      "set",
      "triggers",
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
      "contract",
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
    const classNames = Object.fromEntries(classes.map((c) => [c.id, c.name]));
    const tribeNames = Object.fromEntries(tribes.map((t) => [t.id, t.name]));
    const db = { ...byId, $kw: kw, $tribes: tribeNames };
    const catalog = { byId, heroes, deckRules };
    function targeted(ops, owner, target, allowTarget = true) {
      R.validateEffects(ops, db, owner);
      if (
        ops.some((e) => e.type === "sacrifice") &&
        target !== "friendlyMinion"
      )
        throw Error(owner + ": Sacrifice must target friendly minion");
      const selected = ops.filter((e) => e.to === "selected");
      if (selected.length && (!allowTarget || !target))
        throw Error(owner + ": Selected effect requires a target");
      if (target && !selected.length)
        throw Error(owner + ": Unused target declaration");
      if (
        selected.some((e) =>
          [
            "buff",
            "grant",
            "silence",
            "transform",
            "destroy",
            "sacrifice",
          ].includes(e.type),
        ) &&
        !["enemyMinion", "friendlyMinion", "minion"].includes(target)
      )
        throw Error(owner + ": Effect requires a minion target");
      if (ops.some((e) => e.to === "self" || e.type === "secret"))
        throw Error(
          owner + ": Hero/relic effects cannot use minion self or card secrets",
        );
    }
    for (const c of cards) {
      if (!Object.hasOwn(classNames, c.class))
        throw Error(c.id + ": Invalid class");
      if (c.tribe && !Object.hasOwn(tribeNames, c.tribe))
        throw Error(c.id + ": Invalid tribe");
      if (
        c.onPlay.some((e) => e.type === "sacrifice") &&
        c.target !== "friendlyMinion"
      )
        throw Error(c.id + ": Sacrifice must target friendly minion");
      R.validateTriggers(c.triggers, db, c.id);
      R.validateEffects(c.onPlay, db, c.id);
      R.validateEffects(c.onDeath, db, c.id);
      if (c.onPlay.some((e) => e.to === "selected") && !c.target)
        throw Error(c.id + ": Selected effect requires a target");
      if (
        c.onPlay.some((e) => e.type === "secret") &&
        (!c.secret ||
          !["beforeHeroAttack", "beforeSpell"].includes(c.secret.when) ||
          (c.secret.when === "beforeSpell"
            ? c.secret.counter !== true
            : !(Number.isInteger(c.secret.armor) && c.secret.armor > 0) &&
              byId[c.secret.summon]?.type !== "minion"))
      )
        throw Error(c.id + ": Invalid secret");
      if (c.onDeath.some((e) => e.to === "selected"))
        throw Error(c.id + ": Death effects cannot require player targeting");
      if (
        c.onPlay.some(
          (e) =>
            e.to === "selected" &&
            [
              "buff",
              "grant",
              "silence",
              "transform",
              "destroy",
              "sacrifice",
            ].includes(e.type),
        ) &&
        !["enemyMinion", "friendlyMinion", "minion"].includes(c.target)
      )
        throw Error(c.id + ": Effect requires a minion target");
      if (Boolean(c.secret) !== c.onPlay.some((e) => e.type === "secret"))
        throw Error(c.id + ": Secret definition/effect mismatch");
      if (c.contract) {
        Schema.fields(
          c.contract,
          ["souls", "deaths", "divine", "ritual"],
          c.id,
        );
        if (c.contract.ritual) {
          Schema.fields(c.contract.ritual, ["kind", "amount"], c.id);
          if (
            !["spells", "shields", "hunts"].includes(c.contract.ritual.kind) ||
            !Number.isInteger(c.contract.ritual.amount) ||
            c.contract.ritual.amount < 1 ||
            c.contract.ritual.amount > 20 ||
            !c.contract.divine ||
            "souls" in c.contract ||
            "deaths" in c.contract
          )
            throw Error(c.id + ": Invalid ritual");
        }
        if (
          !c.token ||
          c.type !== "minion" ||
          c.rarity !== "legendary" ||
          (!c.contract.ritual &&
            (!Number.isInteger(c.contract.souls) ||
              c.contract.souls < 1 ||
              c.contract.souls > 10 ||
              !Number.isInteger(c.contract.deaths) ||
              c.contract.deaths < c.contract.souls)) ||
          typeof c.contract.divine !== "boolean"
        )
          throw Error(c.id + ": Invalid contract");
      }
      c.text = R.text(c, db);
      if (c.text.length > MAX_CARD_RULE_CHARS)
        throw Error(
          `${c.id}: Card rules exceed ${MAX_CARD_RULE_CHARS} characters`,
        );
    }
    for (const h of [...heroes, ...bosses]) {
      if (!byId[h.portraitId]) throw Error(h.id + ": Invalid portrait ID");
      targeted(h.powerEffects, h.id, h.target);
    }
    for (const b of bosses) {
      if (
        !Array.isArray(b.deck) ||
        !b.deck.length ||
        b.deck.length * 2 > 100 ||
        b.deck.some((id) => !byId[id] || byId[id].token)
      )
        throw Error(b.id + ": Invalid boss deck reference");
      targeted(b.phaseEffects, b.id + ".phaseEffects", null, false);
    }
    for (const r of relics) {
      R.validateTriggers(r.triggers, db, r.id);
      for (const t of r.triggers || []) targeted(t.effects, r.id, null, false);
      for (const key of ["onStart", "onTurn"])
        if (r[key] !== undefined)
          targeted(r[key], r.id + "." + key, null, false);
    }
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
      r.text = [
        r.maxHealth ? `每场战斗，英雄最大生命值 +${r.maxHealth}。` : "",
        r.spellDamage ? `你的伤害法术额外造成 ${r.spellDamage} 点伤害。` : "",
        r.startingMana ? `每场战斗的起始法力水晶上限 +${r.startingMana}。` : "",
        r.onTurn?.length ? "你的每个回合开始时，" + describe(r.onTurn) : "",
        r.onStart?.length ? "每场战斗开始时，" + describe(r.onStart) : "",
        R.triggerText(r.triggers, db),
      ].join("");
      if (!r.text) throw Error(r.id + ": Relic requires an effect");
    }
    for (const a of archetypes) {
      if (Decks.classFor(catalog, a.hero) !== a.classId)
        throw Error(a.id + ": Invalid archetype hero/class");
      const result = Decks.check(catalog, a.deck, a.hero);
      if (!result.ok) throw Error(a.id + ": " + result.errors.join("; "));
    }
    for (const h of heroes) {
      const preset = archetypes.find((a) => a.id === h.defaultDeckId);
      if (!preset || preset.classId !== h.classId)
        throw Error(h.id + ": Invalid defaultDeckId");
      if (
        h.defaultContracts !== undefined &&
        !Contracts.check({ byId }, h.defaultContracts, h.classId)
      )
        throw Error(h.id + ": Invalid default contracts");
      h.deck = [...preset.deck];
      const result = Decks.check(catalog, h.deck, h.id);
      if (!result.ok) throw Error(h.id + ": " + result.errors.join("; "));
    }
    return R.freeze({
      cards,
      classes,
      tribes,
      deckRules,
      byId,
      heroes,
      bosses,
      relics,
      kw,
      archetypes,
      classNames,
      tribeNames,
    });
  }
  return Object.freeze({ ...create(), create });
})();
if (typeof module !== "undefined") module.exports = EmberData;
