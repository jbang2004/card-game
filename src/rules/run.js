/* The expedition's rules (EmberDungeon, content/dungeon.js): a run's state and every step of it, pure and seeded —
 * the same seed and the same choices always give the same run. The battles themselves are EmberEngine's
 * (start(..., { run: { level, foe } })); this module decides who is met, what is offered and what is kept.
 *
 * A run: { version, heroId, seed, rng, level (1–8, the level being played or chosen), deck, relics, contracts,
 *   devotion (the covenant rituals' progress, kept from battle to battle), gold, removals, seen (opponents met), wins,
 *   step: "route" | "battle" | "treasure" | "bundle" | "tavern" | "won" | "lost", offer (what the step offers),
 *   queue (the steps still to come before the next level), foe (the opponent being fought) }
 * Every change returns a new run; a refused one returns { error }. */
const EmberRun = (() => {
  const VERSION = 1;
  const STEPS = ["route", "battle", "treasure", "bundle", "tavern", "won", "lost"];
  const clone = (x) => structuredClone(x);
  // a small seeded generator (mulberry32) kept in the run itself
  function rand(run) {
    let t = (run.rng = (run.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (run, list) => list[Math.floor(rand(run) * list.length)];
  function shuffle(run, list) {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(run) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function weighted(run, items, weight) {
    const total = items.reduce((s, x) => s + weight(x), 0);
    let r = rand(run) * total;
    for (const x of items) { r -= weight(x); if (r <= 0) return x; }
    return items[items.length - 1];
  }
  const hero = (data, run) => data.heroes.find((h) => h.id === run.heroId);
  const stageOf = (data, level) => data.dungeon.stages[level - 1];

  // ---------------------------------------------------------------- the cards a hero may take
  /** the collectible cards of the hero's class and the neutral ones */
  function pool(data, heroId) {
    const cls = data.heroes.find((h) => h.id === heroId).classId;
    return data.cards.filter((c) => !c.token && (c.class === cls || c.class === "neutral"));
  }
  /** a deck a run may carry: known, collectible, of the hero's class or neutral, 1–60 cards */
  function legalDeck(data, deck, heroId) {
    const ok = new Set(pool(data, heroId).map((c) => c.id));
    return Array.isArray(deck) && deck.length >= 1 && deck.length <= 60 && deck.every((id) => ok.has(id));
  }
  const matches = (t, c) =>
    (t.type === undefined || c.type === t.type) && (t.tribe === undefined || c.tribe === t.tribe) &&
    (t.set === undefined || c.set === t.set) && (t.tags === undefined || t.tags.some((k) => c.tags.includes(k))) &&
    (t.maxCost === undefined || c.cost <= t.maxCost) && (t.minCost === undefined || c.cost >= t.minCost);

  // ---------------------------------------------------------------- opponents
  /** an opponent met at a level: a rival ("rival:<archetype>") or a boss ("<boss id>"), as the engine and the
   *  screens need it — its name, health, deck, and where its hero power and art come from */
  function foe(data, level, id) {
    const stage = stageOf(data, level);
    if (!stage || typeof id !== "string") return null;
    if (id.startsWith("rival:")) {
      const a = data.archetypes.find((x) => x.id === id.slice(6));
      if (!a || !stage.rival || !stage.pool.includes("rival")) return null;
      const h = data.heroes.find((x) => x.id === a.hero);
      // the preset's cheapest cards first: an early rival plays a small, cheap deck
      const deck = [...a.deck].sort((x, y) => data.byId[x].cost - data.byId[y].cost || x.localeCompare(y)).slice(0, stage.rival.cards);
      return { id, kind: "rival", archetype: a.id, hero: h.id, name: a.name, title: h.name, hp: stage.rival.hp, deck, strategy: a.strategy };
    }
    const b = data.bosses.find((x) => x.id === id), index = data.bosses.indexOf(b);
    if (!b || !stage.pool.includes(id)) return null;
    return { id, kind: "boss", bossIndex: index, name: b.name, title: b.title, hp: Math.max(10, Math.round(b.hp * (stage.bossHp ?? 1))), deck: [...b.deck, ...b.deck] };
  }
  /** the two opponents offered at this level (one where the level has only one) — never one already met */
  function foesFor(data, run) {
    const stage = stageOf(data, run.level), rivals = data.archetypes.map((a) => "rival:" + a.id).filter((id) => !run.seen.includes(id));
    const bosses = stage.pool.filter((id) => id !== "rival" && !run.seen.includes(id));
    const candidates = [...(stage.pool.includes("rival") ? rivals : []), ...bosses];
    const fresh = candidates.length ? candidates : stage.pool.filter((id) => id !== "rival");
    // where bosses may appear, one of the two is a boss when any is left
    const first = bosses.length && stage.pool.includes("rival") ? pick(run, bosses) : pick(run, fresh);
    const second = shuffle(run, fresh.filter((id) => id !== first))[0];
    return shuffle(run, second ? [first, second] : [first]);
  }

  // ---------------------------------------------------------------- offers
  function bundles(data, run) {
    const D = data.dungeon, cards = pool(data, run.heroId).filter((c) => c.rarity !== "legendary");
    const themes = shuffle(run, D.themes.filter((t) => cards.filter((c) => matches(t, c)).length >= 3)).slice(0, 3);
    const weight = (c) => (c.rarity === "epic" ? D.rarity.epic + D.rarity.epicPerLevel * run.level : D.rarity[c.rarity]);
    return themes.map((t) => {
      const from = cards.filter((c) => matches(t, c)), got = [];
      while (got.length < 3) { const left = from.filter((c) => !got.includes(c.id)); got.push(weighted(run, left.length ? left : from, weight).id); }
      return { theme: t.id, name: t.name, text: t.text, cards: got };
    });
  }
  function treasures(data, run) {
    const D = data.dungeon, cls = hero(data, run).classId, options = [];
    const relics = data.relics.filter((r) => !run.relics.includes(r.id)).map((r) => ({ kind: "relic", id: r.id }));
    const divine = run.contracts.some((id) => data.byId[id].contract?.divine);
    const contracts = run.contracts.length >= 3 ? [] : data.cards
      .filter((c) => c.contract && c.class === cls && !run.contracts.includes(c.id) && !(divine && c.contract.divine))
      .map((c) => ({ kind: "contract", id: c.id }));
    const cards = pool(data, run.heroId).filter((c) => c.rarity === "legendary" || (c.rarity === "epic" && c.cost >= 4)).map((c) => ({ kind: "card", id: c.id }));
    const kinds = { relic: relics, contract: contracts, card: cards };
    for (let i = 0; i < 3; i++) {
      const open = Object.keys(kinds).filter((k) => kinds[k].some((x) => !options.some((o) => o.kind === x.kind && o.id === x.id)));
      if (!open.length) break;
      const kind = weighted(run, open, (k) => D.treasure[k]);
      options.push(pick(run, kinds[kind].filter((x) => !options.some((o) => o.kind === x.kind && o.id === x.id))));
    }
    return options;
  }
  function tavern(data, run) {
    const D = data.dungeon, cards = pool(data, run.heroId).filter((c) => c.rarity !== "legendary");
    const weight = (c) => (c.rarity === "epic" ? D.rarity.epic + D.rarity.epicPerLevel * run.level : D.rarity[c.rarity]);
    const got = [];
    while (got.length < 3) { const left = cards.filter((c) => !got.includes(c.id)); got.push(weighted(run, left, weight).id); }
    return { cards: got.map((id) => ({ id, price: D.prices[data.byId[id].rarity], sold: false })), removePrice: D.prices.remove + D.prices.removeStep * run.removals };
  }

  // ---------------------------------------------------------------- the steps
  function enter(data, run, step) {
    run.step = step;
    run.offer = step === "route" ? { foes: foesFor(data, run) } : step === "treasure" ? { treasures: treasures(data, run) }
      : step === "bundle" ? { bundles: bundles(data, run) } : step === "tavern" ? tavern(data, run) : null;
    return run;
  }
  /** after a step is done: the next queued one, or the next level's route */
  function next(data, run) {
    const step = run.queue.shift();
    if (step) return enter(data, run, step);
    run.level += 1;
    return enter(data, run, "route");
  }
  /** a new run for this hero */
  function create(data, heroId, seed = Date.now()) {
    const D = data.dungeon;
    if (!data.heroes.some((h) => h.id === heroId) || !D.starters[heroId]) return { error: "未知英雄" };
    const run = { version: VERSION, heroId, seed: seed >>> 0, rng: (seed >>> 0) || 12345, level: 1, deck: [...D.starters[heroId]], relics: [], contracts: [],
      devotion: null, gold: 0, removals: 0, seen: [], wins: 0, step: "route", offer: null, queue: [], foe: null };
    return enter(data, run, "route");
  }
  /** fight one of the offered opponents */
  function choose(data, run0, id) {
    if (run0.step !== "route" || !run0.offer.foes.includes(id)) return { error: "无法挑战该对手" };
    const run = clone(run0);
    run.step = "battle"; run.foe = id; run.offer = null;
    return run;
  }
  /** the battle's end: a win moves on (treasure, bundle, tavern, the next level; the last level wins the run); a
   *  loss or a draw ends it. devotion: the covenant rituals' progress the battle left */
  function resolve(data, run0, winner, devotion = null) {
    if (run0.step !== "battle") return { error: "当前不在战斗中" };
    const run = clone(run0), D = data.dungeon;
    run.seen.push(run.foe);
    if (devotion) run.devotion = clone(devotion);
    if (winner !== "p") { run.step = "lost"; run.offer = null; return run; }
    run.wins += 1; run.gold += D.gold.base + D.gold.perLevel * run.level; run.foe = null;
    if (run.level >= D.levels) { run.step = "won"; run.offer = null; return run; }
    run.queue = [...(D.treasureAfter.includes(run.level) ? ["treasure"] : []), "bundle", ...(D.tavernAfter.includes(run.level) ? ["tavern"] : [])];
    return next(data, run);
  }
  function takeTreasure(data, run0, index) {
    const t = run0.step === "treasure" && run0.offer.treasures[index];
    if (!t) return { error: "无法选择该宝物" };
    const run = clone(run0);
    if (t.kind === "relic") run.relics.push(t.id);
    else if (t.kind === "contract") run.contracts.push(t.id);
    else run.deck.push(t.id);
    return next(data, run);
  }
  function takeBundle(data, run0, index) {
    const b = run0.step === "bundle" && run0.offer.bundles[index];
    if (!b) return { error: "无法选择该卡包" };
    const run = clone(run0);
    run.deck.push(...b.cards);
    return next(data, run);
  }
  function buy(data, run0, index) {
    const item = run0.step === "tavern" && run0.offer.cards[index];
    if (!item || item.sold) return { error: "该卡牌已售出" };
    if (run0.gold < item.price) return { error: "金币不足" };
    const run = clone(run0);
    run.gold -= item.price; run.offer.cards[index].sold = true; run.deck.push(item.id);
    return run;
  }
  /** strike one copy of a card from the deck (the price rises with each) */
  function remove(data, run0, cardId) {
    if (run0.step !== "tavern") return { error: "只能在酒馆删牌" };
    if (!run0.deck.includes(cardId)) return { error: "牌组中没有这张牌" };
    if (run0.deck.length <= 5) return { error: "牌组至少保留 5 张" };
    if (run0.gold < run0.offer.removePrice) return { error: "金币不足" };
    const run = clone(run0);
    run.gold -= run.offer.removePrice; run.deck.splice(run.deck.indexOf(cardId), 1);
    run.removals += 1; run.offer.removePrice += data.dungeon.prices.removeStep;
    return run;
  }
  function leave(data, run0) {
    if (run0.step !== "tavern") return { error: "当前不在酒馆" };
    return next(data, clone(run0));
  }

  // ---------------------------------------------------------------- saves
  /** a stored run is whole and consistent (anything else is discarded, as the match saves are) */
  function valid(run, data) {
    try {
      const D = data.dungeon;
      if (!run || run.version !== VERSION || !D.starters[run.heroId] || !data.heroes.some((h) => h.id === run.heroId)) return false;
      if (!Number.isInteger(run.level) || run.level < 1 || run.level > D.levels || !STEPS.includes(run.step)) return false;
      if (!Number.isInteger(run.rng) || !Number.isInteger(run.gold) || run.gold < 0 || !Number.isInteger(run.removals) || !Number.isInteger(run.wins)) return false;
      if (!legalDeck(data, run.deck, run.heroId)) return false;
      if (!Array.isArray(run.relics) || !run.relics.every((id) => data.relics.some((r) => r.id === id)) || new Set(run.relics).size !== run.relics.length) return false;
      if (!Array.isArray(run.contracts) || !run.contracts.every((id) => data.byId[id]?.contract)) return false;
      if (!Array.isArray(run.seen) || !Array.isArray(run.queue)) return false;
      if (run.step === "battle" && !foe(data, run.level, run.foe)) return false;
      if (run.step === "route" && !(run.offer?.foes?.length && run.offer.foes.every((id) => foe(data, run.level, id)))) return false;
      if (run.step === "bundle" && !run.offer?.bundles?.every((b) => b.cards.every((id) => data.byId[id]))) return false;
      if (run.step === "treasure" && !Array.isArray(run.offer?.treasures)) return false;
      if (run.step === "tavern" && !(Array.isArray(run.offer?.cards) && Number.isInteger(run.offer.removePrice))) return false;
      return true;
    } catch {
      return false;
    }
  }
  return Object.freeze({ VERSION, create, choose, resolve, takeTreasure, takeBundle, buy, remove, leave, foe, pool, legalDeck, valid });
})();
if (typeof module !== "undefined") module.exports = EmberRun;
