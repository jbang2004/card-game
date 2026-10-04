// Automated descents (EmberRun): both sides play the same search policy. A lost battle costs an ember and is fought
// again, as it is for the player; with none left the run is lost. Choices, roughly a careful player's: on the map
// the chapel while an ember is out, then caches and events — but fights first while the deck is small (an elite only
// with two embers);
// of a choice's options the one worth most (embers while one is out, keepsakes, the opponent's amber, cards, marks);
// the bundle of the rarest and dearest cards; at the basket the dearest card and the keepsake the marks cover, and a
// cheap card struck once the deck is past 20. Not human completion rates.
//   node tools/playtest-run.cjs            (PLAYTEST_SEEDS runs per hero, default 6; PLAYTEST_BUDGET search budget;
//                                           PLAYTEST_EPILOGUE=1 to go on to the other side)
const fs = require("fs"),
  D = require("../src/data.js"),
  R = require("../src/rules/run.js"),
  { Game } = require("../src/engine.js");
const seeds = Number(process.env.PLAYTEST_SEEDS || 6),
  budget = Number(process.env.PLAYTEST_BUDGET || 120),
  epilogue = !!process.env.PLAYTEST_EPILOGUE;
const RARITY = { common: 1, rare: 2, epic: 3, legendary: 4 };
// a separate generator for the policy's own choices, so they never move the run's seeded offers
function policy(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function battle(run, seed) {
  const g = new Game();
  const r = g.start(run.heroId, 0, [...run.relics, ...run.boons], run.deck, seed, {
    run: { level: run.tier, foe: run.foe, devotion: run.devotion, pawned: run.pawned },
    contracts: run.contracts,
  });
  if (!r.ok) throw Error(r.error);
  g.mulligan(g.s.p.hand.filter((c) => D.byId[c.cid].cost > 3).map((c) => c.uid));
  g.simulation = true;
  let steps = 0;
  while (g.s.phase === "battle" && steps++ < 600) {
    const side = g.s.active;
    const a = g.dispatch({ ...g.trainingAction(side, { budget }), side });
    if (!a.ok) throw Error(a.error);
  }
  return { winner: g.s.phase === "over" ? g.s.winner : "draw", devotion: g.s.p.devotion, turns: g.s.turn };
}
const full = (run) => run.embers >= D.dungeon.embers;
const placeWorth = (run, n) =>
  ({ chapel: full(run) ? 1 : 6, cache: 5, event: 4, fight: run.deck.length < 22 ? 4.5 : 3, shop: run.gold >= 40 ? 3.5 : 0.5, elite: run.embers >= 2 ? (run.deck.length < 22 ? 4.2 : 2.5) : -1, mirror: 0, boss: 0 })[n.kind];
function optionWorth(run, c) {
  let w = 0;
  for (const e of c.effects) {
    const [k] = Object.keys(e), v = e[k];
    if (k === "ember") w += v > 0 ? (full(run) ? 0 : 4) : -5;
    else if (k === "relic") w += 4;
    else if (k === "trophy" || k === "card") w += 2.5;
    else if (k === "cards") w += RARITY[v.rarity] * v.count;
    else if (k === "gold") w += v / 15;
    else if (k === "boon") w += 1.5;
    else if (k === "forget") w += run.deck.length > 14 ? 1 : 0;
    else if (k === "copy" || k === "redeem") w += 2;
  }
  return w;
}
const rows = [];
for (const h of D.heroes) {
  const acts = Array(D.dungeon.acts.length + 1).fill(0), lostTo = {}, decks = [], falls = [];
  let won = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = policy(seed * 7919);
    let run = R.create(D, h.id, seed * 65537, { epilogue }), guard = 0;
    while (run.step !== "won" && run.step !== "lost") {
      if (guard++ > 2000) throw Error("the run does not end");
      if (run.note) run = R.ack(D, run);
      const s = run.step;
      if (s === "intro") run = R.begin(D, run);
      else if (s === "map") {
        const row = run.at ? run.at.row + 1 : 0, ways = R.ways(run);
        const best = ways.map((c) => ({ c, w: placeWorth(run, run.map.rows[row][c]) + rand() * 0.5 })).sort((a, b) => b.w - a.w)[0];
        run = R.travel(D, run, best.c);
      } else if (s === "encounter") {
        const way = R.choices(D, run).find((c) => c.open && !c.effects.some((e) => e.gold < 0));
        run = R.engage(D, run, way ? way.index : null);
      } else if (s === "battle") {
        const b = battle(run, seed * 1009 + run.wins * 97 + run.falls * 13);
        if (b.winner !== "p") lostTo[run.foe] = (lostTo[run.foe] || 0) + 1;
        run = R.resolve(D, run, b.winner, b.devotion);
      } else if (s === "aftermath" || s === "event") {
        const best = R.choices(D, run).filter((c) => c.open).map((c) => ({ c, w: optionWorth(run, c) + rand() * 0.3 })).sort((a, b) => b.w - a.w)[0];
        run = R.choose(D, run, best.c.index);
      } else if (s === "pick") {
        const m = run.offer.mode, by = (f) => [...run.deck].sort(f)[0];
        run = R.pickCard(D, run, m === "redeem" ? run.pawned[0]
          : m === "copy" ? by((a, b) => RARITY[D.byId[b].rarity] - RARITY[D.byId[a].rarity] || D.byId[b].cost - D.byId[a].cost)
          : run.deck.length > 12 ? by((a, b) => RARITY[D.byId[a].rarity] - RARITY[D.byId[b].rarity] || D.byId[a].cost - D.byId[b].cost) : null);
      } else if (s === "treasure") run = R.takeTreasure(D, run, 0);
      else if (s === "bundle") {
        const score = (b) => b.cards.reduce((t, id) => t + RARITY[D.byId[id].rarity] + D.byId[id].cost / 3, 0) + rand();
        const scores = run.offer.bundles.map(score);
        run = R.takeBundle(D, run, scores.indexOf(Math.max(...scores)));
      } else if (s === "chapel") run = R.rest(D, run, !full(run) ? "kindle" : run.deck.length > 16 ? "forget" : "vigil");
      else if (s === "shop") {
        if (run.offer.relic && !run.offer.relic.sold && run.gold >= run.offer.relic.price) run = R.buyRelic(D, run);
        const ware = run.offer.cards.map((w, i) => ({ ...w, i })).filter((w) => !w.sold && w.price <= run.gold).sort((a, b) => b.price - a.price)[0];
        if (ware) run = R.buy(D, run, ware.i);
        if (run.deck.length > 20 && run.gold >= run.offer.removePrice)
          run = R.remove(D, run, [...run.deck].sort((a, b) => D.byId[a].cost - D.byId[b].cost)[0]);
        run = R.leave(D, run);
      }
      if (run.error) throw Error(run.error + " at " + s);
    }
    acts[run.step === "won" ? D.dungeon.acts.length : run.act]++;
    if (run.step === "won") won++;
    decks.push(run.deck.length);
    falls.push(run.falls);
  }
  const row = { hero: h.id, runs: seeds, won, endedInAct: acts, lostTo, falls, deckSize: decks };
  rows.push(row);
  console.log(JSON.stringify(row));
}
fs.mkdirSync("artifacts/qa", { recursive: true });
fs.writeFileSync("artifacts/qa/run-playtest.json", JSON.stringify({ seeds, budget, epilogue, rows }, null, 2) + "\n");
const total = rows.reduce((n, r) => n + r.won, 0);
console.log(`won ${total} of ${rows.length * seeds} descents (${Math.round((100 * total) / (rows.length * seeds))}%)`);
