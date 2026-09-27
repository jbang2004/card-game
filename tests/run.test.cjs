const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/data.js");
const R = require("../src/rules/run.js");
const State = require("../src/rules/state.js");
const { Game } = require("../src/engine.js");

const ok = (r) => {
  assert.ok(!r.error, r.error);
  assert.ok(R.valid(r, D), "a stored run stays valid after every step");
  return r;
};
/** play a run through with fixed choices: always the first foe, always the first treasure and bundle, buy what is
 *  affordable, strike one card when affordable; the battle's outcome comes from `outcome(run)` */
function play(heroId, seed, outcome = () => "p") {
  let run = ok(R.create(D, heroId, seed));
  const steps = [];
  while (run.step !== "won" && run.step !== "lost") {
    steps.push(run.level + ":" + run.step);
    if (run.step === "route") run = ok(R.choose(D, run, run.offer.foes[0]));
    else if (run.step === "battle") run = ok(R.resolve(D, run, outcome(run)));
    else if (run.step === "treasure") run = ok(R.takeTreasure(D, run, 0));
    else if (run.step === "bundle") run = ok(R.takeBundle(D, run, 0));
    else if (run.step === "tavern") {
      const i = run.offer.cards.findIndex((w) => !w.sold && w.price <= run.gold);
      if (i >= 0) run = ok(R.buy(D, run, i));
      if (run.gold >= run.offer.removePrice) run = ok(R.remove(D, run, run.deck[0]));
      run = ok(R.leave(D, run));
    }
  }
  return { run, steps };
}

test("the expedition content: eight stages, starter decks of the class, a dragon at the end", () => {
  assert.equal(D.dungeon.levels, 8);
  assert.equal(D.dungeon.stages.length, 8);
  for (const h of D.heroes) {
    assert.equal(D.dungeon.starters[h.id].length, 10);
    assert.ok(R.legalDeck(D, D.dungeon.starters[h.id], h.id));
  }
  assert.deepEqual(D.dungeon.stages[7].pool, ["dragon"]);
  for (const [i, st] of D.dungeon.stages.entries())
    for (const id of st.pool.filter((x) => x !== "rival"))
      assert.ok(R.foe(D, i + 1, id), id + " can be met at level " + (i + 1));
});

test("a run is seeded: the same seed and choices give the same run", () => {
  const a = play("mage", 4242), b = play("mage", 4242), c = play("mage", 4243);
  assert.deepEqual(a.run, b.run);
  assert.notDeepEqual(a.run.deck, c.run.deck);
});

test("the eight levels: treasure after 1/3/5/7, bundle after every win, tavern after 2/4/6", () => {
  for (const h of D.heroes) {
    const { run, steps } = play(h.id, 99);
    assert.equal(run.step, "won");
    assert.equal(run.wins, 8);
    // (the spoils of level N are taken while the run is still at level N)
    assert.deepEqual(
      steps.filter((s) => /treasure|tavern/.test(s)),
      ["1:treasure", "2:tavern", "3:treasure", "4:tavern", "5:treasure", "6:tavern", "7:treasure"],
    );
    assert.equal(steps.filter((s) => s.endsWith(":bundle")).length, 7);
    assert.equal(steps.filter((s) => s.endsWith(":route")).length, 8);
    // seven bundles of three, at most one card struck per tavern
    assert.ok(run.deck.length >= 10 + 7 * 3 - 3);
  }
});

test("one loss (or a draw) ends the run", () => {
  const lost = play("paladin", 7, (run) => (run.level === 3 ? "e" : "p")).run;
  assert.equal(lost.step, "lost");
  assert.equal(lost.level, 3);
  assert.equal(lost.wins, 2);
  const drawn = play("ranger", 7, (run) => (run.level === 1 ? "draw" : "p")).run;
  assert.equal(drawn.step, "lost");
  assert.equal(drawn.wins, 0);
});

test("opponents: two to choose from, never met twice, rivals cut down early and bosses scaled", () => {
  const { run } = play("morla", 31337);
  assert.equal(new Set(run.seen).size, run.seen.length);
  let r = R.create(D, "mage", 5);
  assert.equal(r.offer.foes.length, 2);
  for (const id of r.offer.foes) {
    const f = R.foe(D, 1, id);
    assert.equal(f.kind, "rival");
    assert.equal(f.hp, 10);
    assert.equal(f.deck.length, 10);
  }
  const queen = R.foe(D, 3, "queen"), boss = D.bosses.find((b) => b.id === "queen");
  assert.equal(queen.hp, Math.round(boss.hp * D.dungeon.stages[2].bossHp));
  assert.ok(queen.hp < boss.hp);
  assert.equal(queen.deck.length, boss.deck.length * 2);
  assert.equal(R.foe(D, 1, "queen"), null, "a boss appears only where its stage allows");
  assert.equal(R.foe(D, 7, "rival:" + D.archetypes[0].id), null, "no rivals in the last levels");
});

test("refused steps change nothing", () => {
  const r = R.create(D, "mage", 11);
  assert.ok(R.choose(D, r, "dragon").error);
  assert.ok(R.resolve(D, r, "p").error);
  assert.ok(R.takeBundle(D, r, 0).error);
  assert.ok(R.buy(D, r, 0).error);
  assert.ok(R.create(D, "nobody", 1).error);
  const fighting = R.choose(D, r, r.offer.foes[0]);
  assert.equal(r.step, "route", "steps return a new run");
  assert.equal(fighting.step, "battle");
});

test("the tavern: gold buys each card once, striking a card costs more each time, five cards at least", () => {
  let run = R.create(D, "mage", 2024);
  while (run.step !== "tavern") {
    if (run.step === "route") run = R.choose(D, run, run.offer.foes[0]);
    else if (run.step === "battle") run = R.resolve(D, run, "p");
    else if (run.step === "treasure") run = R.takeTreasure(D, run, 0);
    else run = R.takeBundle(D, run, 0);
  }
  assert.equal(run.level, 2);
  assert.equal(run.gold, 10 + 5 + 10 + 10);
  run = { ...run, gold: 500 };
  const bought = ok(R.buy(D, run, 0));
  assert.equal(bought.gold, 500 - run.offer.cards[0].price);
  assert.equal(bought.deck.length, run.deck.length + 1);
  assert.ok(R.buy(D, bought, 0).error, "sold");
  const once = ok(R.remove(D, bought, bought.deck[0]));
  const twice = ok(R.remove(D, once, once.deck[0]));
  assert.equal(once.offer.removePrice, bought.offer.removePrice + D.dungeon.prices.removeStep);
  assert.equal(twice.removals, 2);
  assert.ok(R.remove(D, { ...twice, deck: twice.deck.slice(0, 5) }, twice.deck[0]).error);
  assert.ok(R.remove(D, { ...twice, gold: 0 }, twice.deck[0]).error);
  assert.ok(R.remove(D, twice, "dragon").error);
  assert.equal(ok(R.leave(D, twice)).level, 3);
});

test("stored runs are checked: a foreign card, a boss out of place or an unknown relic is refused", () => {
  const run = R.create(D, "mage", 3);
  assert.ok(R.valid(run, D));
  const foreign = D.cards.find((c) => !c.token && c.class !== "mage" && c.class !== "neutral").id;
  assert.ok(!R.valid({ ...run, deck: [...run.deck, foreign] }, D));
  assert.ok(!R.valid({ ...run, relics: ["nothing"] }, D));
  assert.ok(!R.valid({ ...run, step: "battle", foe: "dragon" }, D));
  assert.ok(!R.valid({ ...run, version: 0 }, D));
  assert.ok(!R.valid(null, D));
});

test("the engine starts an expedition battle: the run's deck, the foe's health and deck, the player first", () => {
  const run = R.create(D, "mage", 8);
  const id = run.offer.foes[0], f = R.foe(D, 1, id);
  const g = new Game();
  assert.ok(g.start("mage", 0, [], run.deck, 17, { run: { level: 1, foe: id }, contracts: [] }).ok);
  assert.equal(g.s.mode, "run");
  assert.deepEqual(g.s.run, { level: 1, foe: id });
  assert.equal(g.s.first, "p");
  assert.equal(g.s.e.hp, f.hp);
  assert.equal(g.s.e.deck.length + g.s.e.hand.length - 1, f.deck.length, "the foe's deck and hand, plus the coin");
  assert.equal(g.s.p.deck.length + g.s.p.hand.length, 10);
  assert.equal(g.s.opponentHero, f.hero);
  assert.ok(State.valid(g.s, D));
  assert.ok(!State.valid({ ...g.s, run: { level: 1, foe: "dragon" } }, D));
  assert.ok(!State.valid({ ...g.s, first: "e" }, D));
  // a deck of the wrong class and an unknown foe are refused
  assert.ok(!g.start("mage", 0, [], ["wolf"], 1, { run: { level: 1, foe: id } }).ok);
  assert.ok(!new Game().start("mage", 0, [], run.deck, 1, { run: { level: 1, foe: "dragon" } }).ok);
});

test("a boss met on the expedition keeps its power, with scaled health", () => {
  const g = new Game();
  assert.ok(g.start("paladin", 0, [], D.dungeon.starters.paladin, 5, { run: { level: 8, foe: "dragon" } }).ok);
  const dragon = D.bosses.findIndex((b) => b.id === "dragon");
  assert.equal(g.s.bossIndex, dragon);
  assert.equal(g.s.e.hp, R.foe(D, 8, "dragon").hp);
  assert.equal(g.s.e.hp, D.bosses[dragon].hp, "the last boss at full strength");
  assert.equal(g.s.opponentHero, undefined);
  assert.ok(State.valid(g.s, D));
});

test("covenant devotion carries from battle to battle, the hunt's turn count does not", () => {
  const g = new Game();
  const devotion = { spells: ["spark", "bolt"], shields: 2, hunts: 3, huntTurn: 4, huntCount: 1 };
  const deck = D.dungeon.starters.mage;
  g.start("mage", 0, [], deck, 9, { run: { level: 1, foe: R.create(D, "mage", 9).offer.foes[0], devotion } });
  assert.deepEqual(g.s.p.devotion, { spells: ["spark", "bolt"], shields: 2, hunts: 3, huntTurn: 0, huntCount: 0 });
  // and the run keeps what the battle left
  let run = R.choose(D, R.create(D, "mage", 9), R.create(D, "mage", 9).offer.foes[0]);
  run = R.resolve(D, run, "p", g.s.p.devotion);
  assert.deepEqual(run.devotion.spells, ["spark", "bolt"]);
});

test("an expedition battle plays to its end and every state on the way is a valid save", () => {
  const run = R.create(D, "ranger", 77);
  const g = new Game();
  g.start("ranger", 0, [], run.deck, 77, { run: { level: 1, foe: run.offer.foes[0] } });
  g.mulligan();
  let n = 0;
  while (g.s.phase === "battle" && n++ < 400) {
    const side = g.s.active;
    const a = g.trainingAction(side, { budget: 40, depth: 3, width: 3 });
    if (a.type === "none") break;
    const r = g.dispatch({ ...a, side });
    if (!r.ok) g.endTurn(side);
    assert.ok(State.valid(g.s, D), "valid at step " + n);
  }
  assert.equal(g.s.phase, "over");
  assert.ok(["p", "e", "draw"].includes(g.s.winner));
});
