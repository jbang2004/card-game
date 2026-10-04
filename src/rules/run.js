/* The descent's rules (EmberDungeon, content/dungeon.js; EmberStory, content/story.js): a run's state and every
 * step of it, pure and seeded — the same seed and the same choices always give the same run. The battles themselves
 * are EmberEngine's (start(..., { run: { level, foe } })); this module decides where the bearer stands, who is met,
 * what is offered and what is kept.
 *
 * A run: { version, heroId, seed, rng,
 *   act (index into dungeon.acts), map ({ rows: [[place]] }: the act's places, charted when the act is entered),
 *   at ({ row, col } | null: where the bearer stands), path ([col]: the places walked through, one per row),
 *   step: "intro" | "map" | "encounter" | "battle" | "aftermath" | "treasure" | "bundle" | "event" | "pick" |
 *         "chapel" | "shop" | "won" | "lost",
 *   offer (what the step offers), queue (the steps still to come at this place), picks ([{ mode, count }]: cards to
 *   strike, copy or redeem before the queue goes on), note ({ say, gains, from } | null: what just happened, to be
 *   read and acknowledged; from: the opponent, event or place it happened at), foe (the opponent stood before), tier (the last battle row's tier), fell (lost to this
 *   opponent and came back),
 *   deck, relics, boons (blessings for the next battle), contracts, devotion (the covenant rituals' progress),
 *   gold, removals, embers, flags, pages (found this run), seen (opponents met), used (events met), wins, falls,
 *   pawned (the cards the last run lost, at the pawnbroker's), left (the cards this run lost, once it is lost),
 *   epilogue (the bearer has sealed the root before: the run is told as its `again` and goes on past the root
 *   sea), tale ([{ foe, choice }]: what was done with whom) }
 * Every change returns a new run; a refused one returns { error }. */
const EmberRun = (() => {
  const VERSION = 2;
  const STEPS = ["intro", "map", "encounter", "battle", "aftermath", "treasure", "bundle", "event", "pick", "chapel", "shop", "won", "lost"];
  const BATTLES = ["fight", "elite", "mirror", "boss"];
  const RARITY = { common: 1, rare: 2, epic: 3, legendary: 4 };
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
  const actOf = (data, run) => data.dungeon.acts[run.act];
  /** the place the bearer stands at (null before the act's first step) */
  const place = (run) => (run.at ? run.map.rows[run.at.row][run.at.col] : null);

  // ---------------------------------------------------------------- the cards a hero may take
  /** the collectible cards of the hero's class and the neutral ones (what bundles, shops and treasures offer) */
  function pool(data, heroId) {
    const cls = data.heroes.find((h) => h.id === heroId).classId;
    return data.cards.filter((c) => !c.token && (c.class === cls || c.class === "neutral"));
  }
  /** a deck a run may carry: known cards of the hero's class, neutral ones, or an opponent's own amber taken as a
   *  trophy (the "foe" class); 1–60 cards */
  function legalDeck(data, deck, heroId) {
    const cls = data.heroes.find((h) => h.id === heroId)?.classId;
    const ok = (id) => { const c = data.byId[id]; return c && !c.token && !c.contract && (c.class === cls || c.class === "neutral" || c.class === "foe"); };
    return Array.isArray(deck) && deck.length >= 1 && deck.length <= 60 && deck.every(ok);
  }
  const matches = (t, c) =>
    (t.type === undefined || c.type === t.type) && (t.tribe === undefined || c.tribe === t.tribe) &&
    (t.set === undefined || c.set === t.set) && (t.tags === undefined || t.tags.some((k) => c.tags.includes(k))) &&
    (t.maxCost === undefined || c.cost <= t.maxCost) && (t.minCost === undefined || c.cost >= t.minCost);

  // ---------------------------------------------------------------- opponents
  /** an opponent at a tier: a rival ("rival:<archetype>") or a boss ("<boss id>"), as the engine and the screens
   *  need it — its name, health, deck, and where its hero power and art come from. ctx: the run's own word on the
   *  battle ({ pawned }: the pawnbroker plays the cards the last run lost) */
  function foe(data, tier, id, ctx = null) {
    const t = data.dungeon.tiers[tier - 1];
    if (!t || typeof id !== "string") return null;
    if (id.startsWith("rival:")) {
      const a = data.archetypes.find((x) => x.id === id.slice(6));
      if (!a || !t.rival) return null;
      const h = data.heroes.find((x) => x.id === a.hero);
      // the preset's cheapest cards first: an early rival plays a small, cheap deck
      const deck = [...a.deck].sort((x, y) => data.byId[x].cost - data.byId[y].cost || x.localeCompare(y)).slice(0, t.rival.cards);
      return { id, kind: "rival", archetype: a.id, hero: h.id, name: a.person ?? a.name, title: a.name, hp: t.rival.hp, deck, strategy: a.strategy };
    }
    const b = data.bosses.find((x) => x.id === id), index = data.bosses.indexOf(b);
    if (!b) return null;
    // where the tier names `bossCards`, a boss plays only that many of its cheapest cards (an early boss is a small deck)
    const deck = [...b.deck, ...b.deck];
    if (t.bossCards) deck.sort((x, y) => data.byId[x].cost - data.byId[y].cost || x.localeCompare(y)).splice(t.bossCards);
    if (id === "pawnbroker" && Array.isArray(ctx?.pawned)) deck.push(...ctx.pawned.filter((c) => data.byId[c] && !data.byId[c].token));
    return { id, kind: "boss", bossIndex: index, name: b.name, title: b.title, hp: Math.max(10, Math.round(b.hp * (t.bossHp ?? 1))), deck };
  }
  /** the run's opponent as its battle will meet it */
  const foeOf = (data, run) => (run.foe ? foe(data, run.tier, run.foe, { pawned: run.pawned }) : null);
  /** the story of an opponent, as this hero meets it: the hero's own lines (vs) laid over the common ones, and over
   *  both what is told the second time (again), on the descent after the bearer's seal */
  function telling(data, run, id = run.foe) {
    if (!id) return null;
    const mute = { setup: [], fall: "", taunt: "" };
    if (id.startsWith("rival:")) return { ...mute, ...data.story.rivals[id.slice(6)], rival: true, aftermath: [] };
    const f = { ...mute, ...data.story.foes[id] }, boss = data.bosses.find((b) => b.id === id);
    const again = (run.epilogue && f.again) || {};
    const told = { ...f, start: f.start ?? boss.quote, ...(f.vs?.[run.heroId] || {}), ...again, ...(again.vs?.[run.heroId] || {}) };
    return { ...told, aftermath: told.aftermath ?? (boss.forHero ? data.story.mirrorAftermath : []) };
  }
  /** an event as this run meets it: one hero's own text (vs), and what is told the second time (again) */
  function eventOf(data, run, id = run.offer?.event) {
    const ev = data.story.events[id];
    return ev ? { ...ev, ...(ev.vs?.[run.heroId] || {}), ...((run.epilogue && ev.again) || {}) } : null;
  }

  // ---------------------------------------------------------------- the map of an act
  /** chart the act the run stands in: its rows of places, who waits at each, which lead where */
  function chart(data, run) {
    const act = actOf(data, run), taken = new Set(run.seen);
    const rivals = () => data.archetypes.map((a) => "rival:" + a.id).filter((id) => !taken.has(id));
    const named = (list) => list.filter((id) => id !== "rival" && !taken.has(id) && (id !== "pawnbroker" || run.pawned.length)
      && (!data.bosses.find((b) => b.id === id).forHero));
    const take = (id) => { taken.add(id); return id; };
    const fight = () => {
      const want = pick(run, act.fights);
      const own = want !== "rival" && named([want]).length ? want : null;
      return take(own ?? pick(run, rivals().length ? rivals() : data.archetypes.map((a) => "rival:" + a.id)));
    };
    // (an event a row names is that row's; the others are drawn)
    const fixed = act.rows.map((row) => row.event).filter(Boolean);
    const events = shuffle(run, act.events.filter((id) => !run.used.includes(id) && !fixed.includes(id)));
    const boss = named(act.bosses).length ? pick(run, named(act.bosses)) : pick(run, act.bosses);
    taken.add(boss);
    const rows = act.rows.map((row) => shuffle(run, row.slots).map((kind) => {
      if (kind === "event" && row.event) return { kind, event: row.event };
      if (kind === "fight") return { kind, foe: fight() };
      if (kind === "elite") {
        const left = named(act.elites);
        return left.length ? { kind, foe: take(pick(run, left)) } : { kind: "fight", foe: fight() };
      }
      if (kind === "mirror") {
        const mine = data.bosses.find((b) => b.forHero === run.heroId);
        return mine ? { kind, foe: mine.id } : { kind: "fight", foe: fight() };
      }
      if (kind === "boss") return { kind, foe: boss };
      if (kind === "event") return events.length ? { kind, event: events.pop() } : { kind: "cache" };
      return { kind };
    }));
    // the ways down: every place leads somewhere and can be reached; a second way now and then, never a crossing
    rows.forEach((row, r) => {
      const below = rows[r + 1];
      if (!below) return;
      const n = row.length, m = below.length;
      const main = row.map((_, a) => (n === 1 ? -1 : Math.round((a * (m - 1)) / (n - 1))));
      row.forEach((node, a) => (node.next = n === 1 ? below.map((_, b) => b) : [main[a]]));
      if (n > 1) {
        below.forEach((_, b) => {
          if (row.some((node) => node.next.includes(b))) return;
          const a = row.reduce((best, _, i) => (Math.abs(main[i] - b) < Math.abs(main[best] - b) ? i : best), 0);
          row[a].next.push(b);
        });
        row.forEach((node, a) => {
          const b = main[a] + (rand(run) < 0.5 ? 1 : -1);
          const crosses = row.some((other, i) => (i < a && other.next.some((x) => x > b)) || (i > a && other.next.some((x) => x < b)));
          if (rand(run) < 0.45 && b >= 0 && b < m && !node.next.includes(b) && !crosses) node.next.push(b);
          node.next.sort((x, y) => x - y);
        });
      }
    });
    rows[rows.length - 1].forEach((node) => (node.next = []));
    run.map = { rows };
    run.at = null;
    run.path = [];
    return run;
  }
  /** the columns the bearer may walk to from where it stands */
  function ways(run) {
    if (run.step !== "map") return [];
    return run.at ? [...place(run).next] : run.map.rows[0].map((_, c) => c);
  }

  // ---------------------------------------------------------------- offers
  function bundles(data, run) {
    const D = data.dungeon, cards = pool(data, run.heroId).filter((c) => c.rarity !== "legendary");
    const themes = shuffle(run, D.themes.filter((t) => cards.filter((c) => matches(t, c)).length >= 3)).slice(0, 3);
    const weight = (c) => (c.rarity === "epic" ? D.rarity.epic + D.rarity.epicPerLevel * run.tier : D.rarity[c.rarity]);
    return themes.map((t) => {
      const from = cards.filter((c) => matches(t, c)), got = [];
      while (got.length < 3) { const left = from.filter((c) => !got.includes(c.id)); got.push(weighted(run, left.length ? left : from, weight).id); }
      return { theme: t.id, name: t.name, text: t.text, cards: got };
    });
  }
  const spareRelics = (data, run) => data.relics.filter((r) => !r.boon && !run.relics.includes(r.id));
  function treasures(data, run) {
    const D = data.dungeon, cls = hero(data, run).classId, options = [];
    const relics = spareRelics(data, run).map((r) => ({ kind: "relic", id: r.id }));
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
  function wares(data, run) {
    const D = data.dungeon, cards = pool(data, run.heroId).filter((c) => c.rarity !== "legendary");
    const weight = (c) => (c.rarity === "epic" ? D.rarity.epic + D.rarity.epicPerLevel * run.tier : D.rarity[c.rarity]);
    const got = [];
    while (got.length < 3) { const left = cards.filter((c) => !got.includes(c.id)); got.push(weighted(run, left, weight).id); }
    const spare = spareRelics(data, run);
    return {
      cards: got.map((id) => ({ id, price: D.prices[data.byId[id].rarity], sold: false })),
      relic: spare.length ? { id: pick(run, spare).id, price: D.prices.relic, sold: false } : null,
      removePrice: D.prices.remove + D.prices.removeStep * run.removals,
    };
  }

  // ---------------------------------------------------------------- choices and what they do
  /** may this choice be taken now? (its `needs`) */
  function allowed(data, run, choice) {
    const n = choice.needs;
    if (!n) return true;
    if (n.gold !== undefined && run.gold < n.gold) return false;
    if (n.embers !== undefined && run.embers < n.embers) return false;
    if (n.flag !== undefined && !run.flags.includes(n.flag)) return false;
    if (n.hero !== undefined && run.heroId !== n.hero) return false;
    if (n.pawned && !run.pawned.length) return false;
    return true;
  }
  /** the choices the step offers: ways past an opponent, what to do with a beaten one, an event's options. A choice
   *  made for another hero (needs.hero), or one that is this hero's own to give to another (needs.not), is not shown
   *  at all; one the run cannot afford is shown and refused. */
  function choices(data, run) {
    const list = run.step === "encounter" ? telling(data, run).approach || []
      : run.step === "aftermath" ? telling(data, run).aftermath
      : run.step === "event" ? eventOf(data, run).options : [];
    return list.map((c, index) => ({ ...c, index, open: allowed(data, run, c) }))
      .filter((c) => (!c.needs?.hero || c.needs.hero === run.heroId) && c.needs?.not !== run.heroId);
  }
  /** carry out a choice's effects; what was gained or given is listed in run.note for the screens */
  function apply(data, run, choice) {
    const gains = [], D = data.dungeon;
    let say = choice.say;
    const give = (kind, id) => gains.push({ kind, id });
    for (const e of choice.effects) {
      const [k] = Object.keys(e), v = e[k];
      if (k === "gold") { const before = run.gold; run.gold = Math.max(0, run.gold + v); gains.push({ kind: "gold", n: run.gold - before }); }
      else if (k === "ember") { const before = run.embers; run.embers = Math.max(1, Math.min(D.embers, run.embers + v)); if (run.embers !== before) gains.push({ kind: "ember", n: run.embers - before }); }
      else if (k === "card") { run.deck.push(v); give("card", v); }
      else if (k === "cards") {
        const from = pool(data, run.heroId).filter((c) => c.rarity === v.rarity);
        for (let i = 0; i < v.count && from.length; i++) { const id = pick(run, from).id; run.deck.push(id); give("card", id); }
      } else if (k === "trophy") { const id = telling(data, run).trophy; if (id) { run.deck.push(id); give("card", id); } }
      else if (k === "relic") {
        const spare = spareRelics(data, run), id = v === "random" ? (spare.length ? pick(run, spare).id : null) : v;
        if (id && !run.relics.includes(id)) { run.relics.push(id); give("relic", id); }
        else { run.gold += 40; gains.push({ kind: "gold", n: 40 }); }
      } else if (k === "boon") { if (!run.boons.includes(v)) run.boons.push(v); give("boon", v); }
      else if (k === "forget" || k === "copy") run.picks.push({ mode: k, count: v });
      else if (k === "redeem") { if (run.pawned.length) run.picks.push({ mode: "redeem", count: Math.min(v, run.pawned.length) }); }
      else if (k === "flag") { if (!run.flags.includes(v)) run.flags.push(v); }
      else if (k === "page") page(run, v, gains);
      else if (k === "gamble") {
        const won = rand(run) < 0.5, before = run.gold;
        run.gold = Math.max(0, run.gold + (won ? v.prize - v.stake : -v.stake));
        gains.push({ kind: "gold", n: run.gold - before });
        say = won ? choice.say.win : choice.say.lose;
      }
    }
    run.note = { say, gains };
    return run;
  }
  function page(run, id, gains = null) {
    if (run.pages.includes(id)) return;
    run.pages.push(id);
    gains?.push({ kind: "page", id });
  }

  // ---------------------------------------------------------------- the steps
  function enter(data, run, step) {
    run.step = step;
    run.offer = step === "treasure" ? { treasures: treasures(data, run) } : step === "bundle" ? { bundles: bundles(data, run) }
      : step === "shop" ? wares(data, run) : step === "event" ? { event: place(run).event } : null;
    return run;
  }
  /** after a step is done: cards still to be picked, the next queued step, or back to the map — and, past the act's
   *  boss, the next act (or the end of the run) */
  function next(data, run) {
    while (run.picks.length) {
      const p = run.picks[0];
      const possible = p.mode === "redeem" ? run.pawned.length > 0 : p.mode === "forget" ? run.deck.length > 5 : run.deck.length < 60;
      if (p.count > 0 && possible) { run.step = "pick"; run.offer = { mode: p.mode, count: p.count }; return run; }
      run.picks.shift();
    }
    const step = run.queue.shift();
    if (step) return enter(data, run, step);
    run.foe = null; run.fell = false;
    if (place(run)?.kind !== "boss") { run.step = "map"; run.offer = null; return run; }
    const story = data.story.acts[actOf(data, run).id], following = data.dungeon.acts[run.act + 1];
    if (story.page) page(run, story.page);
    if (!following || (following.epilogue && !run.epilogue)) { run.step = "won"; run.offer = null; return run; }
    run.act += 1;
    chart(data, run);
    run.step = "intro"; run.offer = null;
    return run;
  }
  /** a new run for this hero. carry: what the bearer's past leaves it ({ pawned: the cards the last run lost,
   *  epilogue: the root has been sealed before, so this run may go on to the other side }) */
  function create(data, heroId, seed = Date.now(), carry = {}) {
    const D = data.dungeon;
    if (!data.heroes.some((h) => h.id === heroId) || !D.starters[heroId]) return { error: "未知英雄" };
    const run = { version: VERSION, heroId, seed: seed >>> 0, rng: (seed >>> 0) || 12345, act: 0, map: null, at: null, path: [],
      step: "intro", offer: null, queue: [], picks: [], note: null, foe: null, tier: 1, fell: false,
      deck: [...D.starters[heroId]], relics: [], boons: [], contracts: [], devotion: null, gold: 0, removals: 0, embers: D.embers,
      flags: [], pages: ["p_bounty"], seen: [], used: [], wins: 0, falls: 0,
      pawned: (carry.pawned || []).filter((id) => data.byId[id] && !data.byId[id].token).slice(0, D.pawned), left: [],
      epilogue: !!carry.epilogue, tale: [] };
    return chart(data, run);
  }
  /** read the act's opening and step onto its map */
  function begin(data, run0) {
    if (run0.step !== "intro") return { error: "当前不在幕间" };
    const run = clone(run0);
    run.step = "map";
    return run;
  }
  /** walk to one of the places below */
  function travel(data, run0, col) {
    if (!ways(run0).includes(col)) return { error: "走不到那里" };
    const run = clone(run0), row = run.at ? run.at.row + 1 : 0;
    run.at = { row, col };
    run.path.push(col);
    run.queue = []; run.note = null; run.fell = false;
    const node = place(run);
    if (BATTLES.includes(node.kind)) {
      run.foe = node.foe;
      run.tier = actOf(data, run).rows[row].tier;
      return enter(data, run, "encounter");
    }
    if (node.kind === "event") run.used.push(node.event);
    return enter(data, run, node.kind === "cache" ? "treasure" : node.kind);
  }
  /** before an opponent: fight (no index), or take one of the ways past it */
  function engage(data, run0, index = null) {
    if (run0.step !== "encounter") return { error: "当前没有对手" };
    const run = clone(run0);
    if (index === null) { run.step = "battle"; run.offer = null; return run; }
    const choice = (telling(data, run).approach || [])[index];
    if (!choice || !allowed(data, run, choice)) return { error: "现在做不到" };
    run.seen.push(run.foe);
    run.tale.push({ foe: run.foe, choice: choice.label, spared: true });
    apply(data, run, choice);
    run.note.from = { foe: run.foe };
    return next(data, run);
  }
  /** the battle's end. A win moves on: marks, what to do with the opponent, a treasure past a boss, a bundle of
   *  cards. A loss (or a draw) costs an ember and the opponent stands where it stood; with none left the run is
   *  lost and its best cards stay down the shaft. devotion: the covenant rituals' progress the battle left */
  function resolve(data, run0, winner, devotion = null) {
    if (run0.step !== "battle") return { error: "当前不在战斗中" };
    const run = clone(run0), D = data.dungeon, node = place(run);
    run.boons = [];
    if (devotion) run.devotion = clone(devotion);
    if (winner !== "p") {
      run.falls += 1; run.embers -= 1;
      if (run.embers > 0) { run.step = "encounter"; run.fell = true; return run; }
      run.step = "lost"; run.offer = null;
      // what stays in the shaft: the best cards the run gathered (never the starter's)
      const spare = [...run.deck], starter = [...D.starters[run.heroId]];
      for (const id of starter) { const i = spare.indexOf(id); if (i >= 0) spare.splice(i, 1); }
      run.left = [...new Set(spare)].sort((a, b) => RARITY[data.byId[b].rarity] - RARITY[data.byId[a].rarity] || data.byId[b].cost - data.byId[a].cost || a.localeCompare(b)).slice(0, D.pawned);
      return run;
    }
    run.seen.push(run.foe);
    run.wins += 1; run.fell = false;
    const named = !run.foe.startsWith("rival:");
    const bounty = data.relics.filter((r) => run.relics.includes(r.id)).reduce((n, r) => n + (r.bounty || 0), 0);
    const prize = D.gold.base + D.gold.perTier * run.tier + (node.kind === "boss" ? D.gold.boss : node.kind !== "fight" && named ? D.gold.elite : 0) + bounty;
    run.gold += prize;
    const story = telling(data, run), gains = [{ kind: "gold", n: prize }];
    if (story.page) page(run, story.page, gains);
    run.note = { say: story.fall, gains, from: { foe: run.foe }, fallen: true };
    const last = node.kind === "boss" && (!D.acts[run.act + 1] || (D.acts[run.act + 1].epilogue && !run.epilogue));
    run.queue = [
      ...(choices(data, { ...run, step: "aftermath" }).length ? ["aftermath"] : []),
      ...(node.kind === "boss" && !last ? ["treasure"] : []),
      ...(last ? [] : ["bundle"]),
    ];
    return next(data, run);
  }
  /** take one of the step's choices (what to do with a beaten opponent, an event's option) */
  function choose(data, run0, index) {
    if (run0.step !== "aftermath" && run0.step !== "event") return { error: "当前没有选择" };
    const choice = choices(data, run0).find((c) => c.index === index);
    if (!choice || !choice.open) return { error: "现在做不到" };
    const run = clone(run0);
    const from = run.step === "aftermath" ? { foe: run.foe } : { event: run.offer.event };
    if (run.step === "aftermath") run.tale.push({ foe: run.foe, choice: choice.label });
    apply(data, run, choice);
    run.note.from = from;
    return next(data, run);
  }
  /** the note has been read */
  function ack(data, run0) {
    const run = clone(run0);
    run.note = null;
    return run;
  }
  /** a card is picked for what the last choice asked: struck (forget), copied, or taken back from the pawnbroker
   *  (redeem). No card (null): leave it at that. */
  function pickCard(data, run0, cardId = null) {
    if (run0.step !== "pick") return { error: "当前不需要选牌" };
    const run = clone(run0), p = run.picks[0];
    if (cardId === null) { run.picks.shift(); return next(data, run); }
    if (p.mode === "redeem") {
      const i = run.pawned.indexOf(cardId);
      if (i < 0) return { error: "当铺里没有这张牌" };
      run.pawned.splice(i, 1); run.deck.push(cardId);
    } else {
      if (!run.deck.includes(cardId)) return { error: "牌组中没有这张牌" };
      if (p.mode === "forget") { run.deck.splice(run.deck.indexOf(cardId), 1); }
      else run.deck.push(cardId);
    }
    p.count -= 1;
    return next(data, run);
  }
  /** the chapel: one of three rests */
  function rest(data, run0, what) {
    if (run0.step !== "chapel") return { error: "当前不在礼拜堂" };
    const run = clone(run0), C = data.story.chapel, D = data.dungeon;
    if (what === "kindle") {
      if (run.embers >= D.embers) return { error: "火种已满" };
      run.embers += 1;
      run.note = { say: C.kindle.say, gains: [{ kind: "ember", n: 1 }] };
    } else if (what === "forget") {
      run.picks.push({ mode: "forget", count: 2 });
      run.note = { say: C.forget.say, gains: [] };
    } else if (what === "vigil") {
      if (!run.boons.includes("b_vigil")) run.boons.push("b_vigil");
      run.note = { say: C.vigil.say, gains: [{ kind: "boon", id: "b_vigil" }] };
    } else return { error: "未知的歇脚方式" };
    run.note.from = { place: "chapel" };
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
  /** take a bundle of three cards, or none (index -1) */
  function takeBundle(data, run0, index) {
    if (run0.step !== "bundle") return { error: "当前没有卡包" };
    const b = run0.offer.bundles[index];
    if (!b && index !== -1) return { error: "无法选择该卡包" };
    const run = clone(run0);
    if (b) run.deck.push(...b.cards);
    return next(data, run);
  }
  function buy(data, run0, index) {
    const item = run0.step === "shop" && run0.offer.cards[index];
    if (!item || item.sold) return { error: "该卡牌已售出" };
    if (run0.gold < item.price) return { error: "马克不足" };
    const run = clone(run0);
    run.gold -= item.price; run.offer.cards[index].sold = true; run.deck.push(item.id);
    return run;
  }
  function buyRelic(data, run0) {
    const item = run0.step === "shop" && run0.offer.relic;
    if (!item || item.sold) return { error: "已售出" };
    if (run0.gold < item.price) return { error: "马克不足" };
    const run = clone(run0);
    run.gold -= item.price; run.offer.relic.sold = true; run.relics.push(item.id);
    return run;
  }
  /** strike one copy of a card from the deck at the shop (the price rises with each) */
  function remove(data, run0, cardId) {
    if (run0.step !== "shop") return { error: "只能在吊篮处删牌" };
    if (!run0.deck.includes(cardId)) return { error: "牌组中没有这张牌" };
    if (run0.deck.length <= 5) return { error: "牌组至少保留 5 张" };
    if (run0.gold < run0.offer.removePrice) return { error: "马克不足" };
    const run = clone(run0);
    run.gold -= run.offer.removePrice; run.deck.splice(run.deck.indexOf(cardId), 1);
    run.removals += 1; run.offer.removePrice += data.dungeon.prices.removeStep;
    return run;
  }
  function leave(data, run0) {
    if (run0.step !== "shop") return { error: "当前不在吊篮处" };
    return next(data, clone(run0));
  }

  // ---------------------------------------------------------------- saves
  /** a stored run is whole and consistent (anything else is discarded, as the match saves are) */
  function valid(run, data) {
    try {
      const D = data.dungeon, ints = (...xs) => xs.every((x) => Number.isInteger(x));
      if (!run || run.version !== VERSION || !D.starters[run.heroId] || !data.heroes.some((h) => h.id === run.heroId)) return false;
      if (!ints(run.act, run.rng, run.gold, run.removals, run.wins, run.falls, run.embers, run.tier) || !D.acts[run.act] || !STEPS.includes(run.step)) return false;
      if (run.gold < 0 || run.embers < 0 || run.embers > D.embers || !D.tiers[run.tier - 1]) return false;
      if (!legalDeck(data, run.deck, run.heroId)) return false;
      const relic = (id, boon) => data.relics.some((r) => r.id === id && !!r.boon === boon);
      if (!Array.isArray(run.relics) || !run.relics.every((id) => relic(id, false)) || new Set(run.relics).size !== run.relics.length) return false;
      if (!Array.isArray(run.boons) || !run.boons.every((id) => relic(id, true)) || new Set(run.boons).size !== run.boons.length) return false;
      if (!Array.isArray(run.contracts) || !run.contracts.every((id) => data.byId[id]?.contract)) return false;
      for (const k of ["seen", "used", "flags", "pages", "queue", "picks", "pawned", "left", "tale", "path"]) if (!Array.isArray(run[k])) return false;
      if (!run.pawned.every((id) => data.byId[id]) || !run.pages.every((id) => data.story.pages.some((p) => p.id === id))) return false;
      // the map: the act's rows, real places, ways that exist; the bearer on one of them
      const rows = run.map?.rows, act = D.acts[run.act];
      if (!Array.isArray(rows) || rows.length !== act.rows.length) return false;
      for (const [r, row] of rows.entries())
        for (const n of row) {
          if (BATTLES.includes(n.kind) ? !foe(data, act.rows[r].tier, n.foe) : n.kind === "event" ? !data.story.events[n.event] : !["chapel", "shop", "cache"].includes(n.kind)) return false;
          if (!Array.isArray(n.next) || n.next.some((c) => !rows[r + 1]?.[c])) return false;
        }
      if (run.at && !rows[run.at.row]?.[run.at.col]) return false;
      if (["encounter", "battle", "aftermath"].includes(run.step) && !(run.at && foeOf(data, run))) return false;
      if (run.step === "event" && !data.story.events[run.offer?.event]) return false;
      if (run.step === "bundle" && !run.offer?.bundles?.every((b) => b.cards.every((id) => data.byId[id]))) return false;
      if (run.step === "treasure" && !Array.isArray(run.offer?.treasures)) return false;
      if (run.step === "shop" && !(Array.isArray(run.offer?.cards) && Number.isInteger(run.offer.removePrice))) return false;
      if (run.step === "pick" && !(run.picks[0] && ["forget", "copy", "redeem"].includes(run.offer?.mode))) return false;
      return true;
    } catch {
      return false;
    }
  }
  return Object.freeze({ VERSION, create, begin, travel, engage, resolve, choose, ack, pickCard, rest, takeTreasure, takeBundle, buy, buyRelic, remove, leave,
    foe, foeOf, telling, eventOf, choices, allowed, ways, place, pool, legalDeck, valid });
})();
if (typeof module !== "undefined") module.exports = EmberRun;
