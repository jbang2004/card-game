// Automated expedition runs (EmberRun): both sides play the same search policy, one attempt per battle (a loss ends
// the run, as it does for the player). Choices, roughly a careful player's: the foe with less health, the first
// treasure, the bundle of the rarest and dearest cards, buy the dearest card the gold covers, strike the cheapest
// card once the deck is past 20. Not human completion rates.
//   node tools/playtest-run.cjs            (PLAYTEST_SEEDS runs per hero, default 6; PLAYTEST_BUDGET search budget)
const fs = require("fs"),
  D = require("../src/data.js"),
  R = require("../src/rules/run.js"),
  { Game } = require("../src/engine.js");
const seeds = Number(process.env.PLAYTEST_SEEDS || 6),
  budget = Number(process.env.PLAYTEST_BUDGET || 120);
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
  const r = g.start(run.heroId, 0, run.relics, run.deck, seed, {
    run: { level: run.level, foe: run.foe, devotion: run.devotion },
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
const rows = [];
for (const h of D.heroes) {
  const reached = Array(D.dungeon.levels + 1).fill(0),
    lostTo = {},
    decks = [];
  let won = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const rand = policy(seed * 7919);
    let run = R.create(D, h.id, seed * 65537);
    while (run.step !== "won" && run.step !== "lost") {
      if (run.step === "route") {
        const foes = run.offer.foes.map((id) => R.foe(D, run.level, id));
        const low = Math.min(...foes.map((f) => f.hp)), easiest = foes.filter((f) => f.hp === low);
        run = R.choose(D, run, easiest[Math.floor(rand() * easiest.length)].id);
      }
      else if (run.step === "battle") {
        const b = battle(run, seed * 1009 + run.level * 97);
        if (b.winner !== "p") lostTo[run.foe] = (lostTo[run.foe] || 0) + 1;
        run = R.resolve(D, run, b.winner, b.devotion);
      } else if (run.step === "treasure") run = R.takeTreasure(D, run, 0);
      else if (run.step === "bundle") {
        const score = (b) => b.cards.reduce((s, id) => s + RARITY[D.byId[id].rarity] + D.byId[id].cost / 3, 0) + rand();
        const scores = run.offer.bundles.map(score);
        run = R.takeBundle(D, run, scores.indexOf(Math.max(...scores)));
      }
      else if (run.step === "tavern") {
        const ware = run.offer.cards
          .map((w, i) => ({ ...w, i }))
          .filter((w) => !w.sold && w.price <= run.gold)
          .sort((a, b) => b.price - a.price)[0];
        if (ware) run = R.buy(D, run, ware.i);
        if (run.deck.length > 20 && run.gold >= run.offer.removePrice) {
          const cheapest = [...run.deck].sort((a, b) => D.byId[a].cost - D.byId[b].cost)[0];
          run = R.remove(D, run, cheapest);
        }
        run = R.leave(D, run);
      }
      if (run.error) throw Error(run.error);
    }
    reached[run.step === "won" ? D.dungeon.levels : run.level - 1]++;
    if (run.step === "won") won++;
    decks.push(run.deck.length);
  }
  const row = { hero: h.id, runs: seeds, won, clearedLevels: reached, lostTo, deckSize: decks };
  rows.push(row);
  console.log(JSON.stringify(row));
}
fs.mkdirSync("artifacts/qa", { recursive: true });
fs.writeFileSync(
  "artifacts/qa/run-playtest.json",
  JSON.stringify(
    {
      method:
        "Same-policy automated expedition runs, one attempt per battle; the weaker foe, the first treasure, the rarest bundle, a greedy tavern. clearedLevels[n] = runs that cleared exactly n levels. Not human completion rates.",
      rows,
    },
    null,
    2,
  ) + "\n",
);
