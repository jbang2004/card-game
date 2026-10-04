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
  const portraits =
    typeof EmberPortraits !== "undefined"
      ? EmberPortraits
      : require("./content/portraits.js");
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
  const expedition =
    typeof EmberDungeon !== "undefined"
      ? EmberDungeon
      : require("./content/dungeon.js");
  const tale =
    typeof EmberStory !== "undefined"
      ? EmberStory
      : require("./content/story.js");
  function create(input = definitions, world = campaign, dungeonDef = expedition, storyDef = tale) {
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
      if (!portraits[h.portraitId]) throw Error(h.id + ": Invalid portrait ID");
      if (byId[h.portraitId]) throw Error(h.id + ": A portrait ID may not be a card ID");
      targeted(h.powerEffects, h.id, h.target);
    }
    for (const a of archetypes) {
      if (a.portraitId && !portraits[a.portraitId]) throw Error(a.id + ": Invalid portrait ID");
      if (a.portraitId && byId[a.portraitId]) throw Error(a.id + ": A portrait ID may not be a card ID");
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
        r.bounty ? `远征中每场胜利额外获得 ${r.bounty} 马克。` : "",
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
    // the expedition (content/dungeon.js): its starter decks are the class's own cards, its stages name real
    // opponents, its prices are whole
    const dungeon = structuredClone(dungeonDef);
    for (const h of heroes) {
      // a hero without a starter of its own sets out with its deck's ten cheapest cards
      dungeon.starters[h.id] ??= [...h.deck].sort((a, b) => byId[a].cost - byId[b].cost || a.localeCompare(b)).slice(0, 10);
      const deck = dungeon.starters[h.id], cls = h.classId;
      if (
        !Array.isArray(deck) ||
        deck.length < 5 ||
        deck.some((id) => !byId[id] || byId[id].token || (byId[id].class !== cls && byId[id].class !== "neutral"))
      )
        throw Error(h.id + ": Invalid dungeon starter deck");
    }
    // the acts: every opponent, event and row they name exists, a battle row names a tier with what it needs
    const story = structuredClone(storyDef), KINDS = ["fight", "elite", "mirror", "boss", "event", "chapel", "shop", "cache"];
    const isBoss = (id) => bosses.some((b) => b.id === id);
    if (!Array.isArray(dungeon.tiers) || !dungeon.tiers.length || !Array.isArray(dungeon.acts) || !dungeon.acts.length)
      throw Error("dungeon: tiers and acts are required");
    for (const act of dungeon.acts) {
      if (!story.acts[act.id]) throw Error("dungeon act " + act.id + ": no story");
      for (const id of [...act.fights, ...act.elites, ...act.bosses])
        if (id !== "rival" && !isBoss(id)) throw Error("dungeon act " + act.id + ": unknown opponent " + id);
      for (const id of act.events) if (!story.events[id]) throw Error("dungeon act " + act.id + ": unknown event " + id);
      for (const row of act.rows) if (row.event && !(act.events.includes(row.event) && row.slots.join() === "event")) throw Error("dungeon act " + act.id + ": a row's event is one of the act's, alone on its row");
      if (!act.bosses.length) throw Error("dungeon act " + act.id + ": no boss");
      act.rows.forEach((row, i) => {
        if (!Array.isArray(row.slots) || !row.slots.length || row.slots.some((k) => !KINDS.includes(k)))
          throw Error("dungeon act " + act.id + " row " + i + ": Invalid slots");
        const battle = row.slots.some((k) => ["fight", "elite", "mirror", "boss"].includes(k));
        if (battle && !dungeon.tiers[row.tier - 1]) throw Error("dungeon act " + act.id + " row " + i + ": a battle row names a tier");
        if (row.slots.includes("fight") && act.fights.includes("rival") && !dungeon.tiers[row.tier - 1].rival)
          throw Error("dungeon act " + act.id + " row " + i + ": the tier has no rival");
      });
      if (act.rows[act.rows.length - 1].slots.join() !== "boss") throw Error("dungeon act " + act.id + ": the last row is the boss");
    }
    for (const k of ["common", "rare", "epic", "legendary", "relic", "remove", "removeStep"])
      if (!Number.isInteger(dungeon.prices[k]) || dungeon.prices[k] < 0) throw Error("dungeon: Invalid price " + k);
    // the story (content/story.js): its opponents, cards, relics, pages and choices are real
    const pageIds = new Set(story.pages.map((p) => p.id));
    if (pageIds.size !== story.pages.length) throw Error("story: Duplicate page");
    const EFFECTS = ["gold", "ember", "card", "cards", "trophy", "relic", "boon", "forget", "copy", "redeem", "flag", "page", "gamble"];
    const checkChoice = (c, owner, trophy) => {
      if (typeof c.label !== "string" || !c.label || !Array.isArray(c.effects) || !c.say) throw Error(owner + ": Invalid choice");
      for (const e of c.effects) {
        const keys = Object.keys(e);
        if (keys.length !== 1 || !EFFECTS.includes(keys[0])) throw Error(owner + ": Unknown effect " + keys.join());
        const [k] = keys, v = e[k];
        if (k === "card" && (!byId[v] || byId[v].token)) throw Error(owner + ": Unknown card " + v);
        if (k === "relic" && v !== "random" && !relics.some((r) => r.id === v && !r.boon)) throw Error(owner + ": Unknown relic " + v);
        if (k === "boon" && !relics.some((r) => r.id === v && r.boon)) throw Error(owner + ": Unknown blessing " + v);
        if (k === "page" && !pageIds.has(v)) throw Error(owner + ": Unknown page " + v);
        if (k === "trophy" && !trophy) throw Error(owner + ": no trophy to give");
        if (k === "cards" && !(["common", "rare", "epic"].includes(v.rarity) && Number.isInteger(v.count) && v.count > 0)) throw Error(owner + ": Invalid cards");
        if (["gold", "ember", "forget", "copy", "redeem"].includes(k) && !Number.isInteger(v)) throw Error(owner + ": Invalid " + k);
        if (k === "gamble" && !(Number.isInteger(v.stake) && Number.isInteger(v.prize) && c.say.win && c.say.lose)) throw Error(owner + ": Invalid gamble");
      }
      for (const k of ["hero", "not"]) if (c.needs?.[k] && !heroes.some((h) => h.id === c.needs[k])) throw Error(owner + ": needs an unknown hero");
    };
    // every hero is left a real choice (an option may be another bearer's alone, or hidden from one)
    const checkOptions = (list, owner) => {
      if (!Array.isArray(list)) throw Error(owner + ": Invalid options");
      for (const c of list) checkChoice(c, owner, null);
      for (const h of heroes)
        if (list.filter((c) => (!c.needs?.hero || c.needs.hero === h.id) && c.needs?.not !== h.id).length < 2) throw Error(owner + ": fewer than two options for " + h.id);
    };
    const isHero = (id) => heroes.some((h) => h.id === id);
    for (const b of bosses) {
      // (an opponent the story does not tell of yet is met without words)
      const f = story.foes[b.id];
      if (!f) continue;
      if (!Array.isArray(f.setup) || !f.fall || !f.taunt) throw Error("story: " + b.id + " has no encounter");
      if (f.trophy && (!byId[f.trophy] || byId[f.trophy].token)) throw Error("story: " + b.id + " trophy is no card");
      if (f.page && !pageIds.has(f.page)) throw Error("story: " + b.id + " page is unknown");
      for (const c of [...(f.approach || []), ...(f.aftermath || []), ...(f.again?.aftermath || [])]) checkChoice(c, "story." + b.id, f.trophy);
      for (const h of [...Object.keys(f.vs || {}), ...Object.keys(f.again?.vs || {})]) if (!isHero(h)) throw Error("story: " + b.id + ".vs names no hero");
    }
    for (const c of story.mirrorAftermath) checkChoice(c, "story.mirrorAftermath", null);
    for (const [id, r] of Object.entries(story.rivals)) if (!Array.isArray(r.setup) || !r.fall) throw Error("story: rival " + id + " has no encounter");
    for (const [id, ev] of Object.entries(story.events)) {
      if (!ev.title || !Array.isArray(ev.text)) throw Error("story: Invalid event " + id);
      checkOptions(ev.options, "story.events." + id);
      if (ev.again?.options) checkOptions(ev.again.options, "story.events." + id + ".again");
      for (const [h, mine] of Object.entries(ev.vs || {})) if (!isHero(h) || !Array.isArray(mine.text)) throw Error("story: event " + id + ".vs is invalid");
    }
    for (const [id, act] of Object.entries(story.acts)) {
      if (act.page && !pageIds.has(act.page)) throw Error("story: act page is unknown");
      for (const h of Object.keys(act.voice || {})) if (h !== "all" && !isHero(h)) throw Error("story: act " + id + ".voice names no hero");
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
      dungeon,
      story,
    });
  }
  return Object.freeze({ ...create(), create });
})();
if (typeof module !== "undefined") module.exports = EmberData;
