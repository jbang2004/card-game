const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/data.js");
const R = require("../src/rules/run.js");
const C = require("../src/rules/chronicle.js");
const State = require("../src/rules/state.js");
const { Game } = require("../src/engine.js");

const ok = (r) => {
  assert.ok(!r.error, r.error);
  assert.ok(R.valid(r, D), "a stored run stays valid after every step (" + r.step + ")");
  return r;
};
/** walk a run down with fixed choices. policy: { way(run) → index into the ways, outcome(run) → battle winner,
 *  option(run, choices) → the choice taken, until(run) → stop here } */
function play(heroId, seed, policy = {}, carry = {}) {
  const { way = () => 0, outcome = () => "p", option = (run, cs) => cs.find((c) => c.open), until = () => false } = policy;
  let run = ok(R.create(D, heroId, seed, carry));
  const steps = [];
  let guard = 0;
  while (run.step !== "won" && run.step !== "lost" && !until(run)) {
    assert.ok(guard++ < 500, "the run ends");
    if (run.note) run = ok(R.ack(D, run));
    const s = run.step;
    steps.push(run.act + ":" + s);
    if (s === "intro") run = ok(R.begin(D, run));
    else if (s === "map") { const w = R.ways(run); run = ok(R.travel(D, run, w[way(run) % w.length])); }
    else if (s === "encounter") run = ok(R.engage(D, run));
    else if (s === "battle") run = ok(R.resolve(D, run, outcome(run)));
    else if (s === "aftermath" || s === "event") run = ok(R.choose(D, run, option(run, R.choices(D, run)).index));
    else if (s === "pick") run = ok(R.pickCard(D, run, run.offer.mode === "redeem" ? run.pawned[0] : run.deck[run.deck.length - 1]));
    else if (s === "treasure") run = ok(R.takeTreasure(D, run, 0));
    else if (s === "bundle") run = ok(R.takeBundle(D, run, 0));
    else if (s === "chapel") run = ok(R.rest(D, run, run.embers < D.dungeon.embers ? "kindle" : "vigil"));
    else if (s === "shop") run = ok(R.leave(D, run));
  }
  return { run, steps };
}
const kinds = (run) => run.map.rows.map((row) => row.map((n) => n.kind));

test("the descent's content: starters of the class, tiers for every battle row, a story for every act and opponent", () => {
  for (const h of D.heroes) {
    assert.equal(D.dungeon.starters[h.id].length, 10);
    assert.ok(R.legalDeck(D, D.dungeon.starters[h.id], h.id));
    assert.ok(D.story.heroes[h.id].vow);
    assert.ok(D.story.endings.seal.hero[h.id]);
    assert.ok(D.story.pages.some((p) => p.id === "p_end_" + h.id));
    // the second telling, and Natan's voice on the way down, are written for every bearer
    assert.ok(D.story.heroes[h.id].again && D.story.endings.mirror.hero[h.id]);
    for (const act of ["mine", "strata", "roots"]) assert.ok(D.story.acts[act].voice.all && D.story.acts[act].voice[h.id] && D.story.acts[act].again.voice);
  }
  assert.deepEqual(D.dungeon.acts.map((a) => a.id), ["mine", "strata", "roots", "rootsea", "otherside"]);
  assert.deepEqual(D.dungeon.acts[3].bosses, ["dragon"]);
  assert.deepEqual(D.dungeon.acts[4].bosses, ["eve"]);
  assert.ok(D.dungeon.acts[4].epilogue);
  for (const b of D.bosses) assert.ok(D.story.foes[b.id].setup.length >= 2, b.id + " has its encounter told");
  for (const a of D.archetypes) assert.ok(D.story.rivals[a.id].setup.length >= 2, a.id + " has its encounter told");
  // every relic a story names is a keepsake, never a blessing; every blessing borrows a real picture
  for (const r of D.relics.filter((x) => x.boon)) assert.ok(D.relics.some((x) => x.id === r.like && !x.boon));
});

test("a run is seeded: the same seed and choices give the same run", () => {
  const a = play("mage", 4242), b = play("mage", 4242), c = play("mage", 4243);
  assert.deepEqual(a.run, b.run);
  assert.notDeepEqual(R.create(D, "mage", 4242).map, R.create(D, "mage", 4243).map);
  assert.notDeepEqual(a.run.deck, c.run.deck);
});

test("an act's map: the template's rows, every place reachable and leading on, no way crossing another", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const run = R.create(D, D.heroes[seed % 4].id, seed * 7919), act = D.dungeon.acts[0];
    assert.equal(run.map.rows.length, act.rows.length);
    run.map.rows.forEach((row, r) => {
      // an elite or an event that cannot be filled falls back, never an empty place
      assert.equal(row.length, act.rows[r].slots.length);
      const below = run.map.rows[r + 1];
      if (!below) { assert.deepEqual(row.map((n) => n.next), [[]]); return; }
      for (const n of row) assert.ok(n.next.length >= 1 && n.next.every((c) => below[c]));
      below.forEach((_, c) => assert.ok(row.some((n) => n.next.includes(c)), "place " + c + " of row " + (r + 1) + " can be reached"));
      row.forEach((a, i) => row.slice(i + 1).forEach((b) => assert.ok(Math.max(...a.next) <= Math.min(...b.next), "no crossing ways")));
    });
    assert.equal(kinds(run).at(-1).join(), "boss");
    const foes = run.map.rows.flat().filter((n) => n.foe).map((n) => n.foe);
    assert.equal(new Set(foes).size, foes.length, "nobody waits at two places");
    assert.ok(!foes.includes("pawnbroker"), "the pawnbroker has nothing of a first run's");
  }
});

test("the four acts: intro, the map down to its boss, treasure and bundle past it, and the root sealed", () => {
  for (const h of D.heroes) {
    const { run, steps } = play(h.id, 99);
    assert.equal(run.step, "won");
    assert.equal(run.act, 3, "without the epilogue the run ends at the root sea");
    assert.deepEqual(steps.filter((s) => s.endsWith(":intro")), ["0:intro", "1:intro", "2:intro", "3:intro"]);
    assert.equal(steps.filter((s) => s.endsWith(":treasure") && s[0] !== "3").length >= 3, true);
    assert.equal(new Set(run.seen).size, run.seen.length, "no opponent is met twice");
    assert.ok(run.seen.includes("dragon") && run.seen.includes("ada") && run.seen.includes("frost"));
    assert.ok(run.seen.some((id) => D.bosses.find((b) => b.id === id)?.forHero === h.id), "the bearer met its own reflection");
    for (const id of ["p_bounty", "p_act1", "p_act2", "p_act3", "p_keeper", "p_mirror", "p_ada", "p_eve", "p_order"]) assert.ok(run.pages.includes(id), id);
    assert.ok(run.used.indexOf("gathering") >= 0 && run.used.indexOf("gathering") < run.used.indexOf("watch"), "the bearers gather at the root sea, then the workbench");
    assert.ok(run.wins >= 7 && run.wins <= 13);
  }
});

test("the epilogue: a bearer who sealed the root before goes on to the other side", () => {
  const { run, steps } = play("morla", 5, {}, { epilogue: true });
  assert.equal(run.step, "won");
  assert.equal(run.act, 4);
  assert.ok(steps.includes("4:intro") && run.seen.includes("eve") && run.pages.includes("p_othereve") && run.pages.includes("p_hearth"));
  assert.ok(!run.pages.includes("p_order"), "the letters were read on the first descent");
});

test("the other bearers: an event shows a bearer the other three, never itself; the second descent is told anew", () => {
  for (const id of ["crossing", "lamps", "gathering"])
    for (const h of D.heroes) {
      const cs = R.choices(D, { step: "event", heroId: h.id, offer: { event: id }, gold: 0, embers: 3, flags: [], pawned: [] });
      assert.equal(cs.length, 3, id + " for " + h.id);
      assert.ok(cs.every((c) => c.needs.not !== h.id && c.open));
    }
  // one hero's own text
  assert.notDeepEqual(R.eventOf(D, { heroId: "mage" }, "letters").text, R.eventOf(D, { heroId: "paladin" }, "letters").text);
  // the root sea opens on the gathering
  const first = R.create(D, "ranger", 77), sea = D.dungeon.acts.findIndex((a) => a.id === "rootsea");
  const at = play("ranger", 77, { until: (x) => x.act === sea && x.step === "map" }).run;
  assert.deepEqual(at.map.rows.slice(0, 2).map((row) => row.map((n) => n.event)), [["gathering"], ["watch"]]);
  assert.ok(!first.epilogue);
  // told again: the acts, the bearer, the keepers of the way, Natan and the gathering
  const again = { heroId: "paladin", epilogue: true }, once = { heroId: "paladin", epilogue: false };
  for (const foe of ["frost", "ada", "dragon"]) assert.notDeepEqual(R.telling(D, { ...again, foe }).setup, R.telling(D, { ...once, foe }).setup, foe);
  assert.notEqual(R.telling(D, { ...again, foe: "dragon" }).start, R.telling(D, { ...once, foe: "dragon" }).start);
  assert.notEqual(R.telling(D, { ...again, foe: "ada" }).aftermath, R.telling(D, { ...once, foe: "ada" }).aftermath);
  assert.equal(R.telling(D, { ...again, foe: "warden" }).start, R.telling(D, { ...once, foe: "warden" }).start);
  assert.notEqual(R.eventOf(D, again, "gathering").title, R.eventOf(D, once, "gathering").title);
  assert.ok(R.eventOf(D, again, "gathering").options.every((c) => !c.effects.some((e) => e.page)));
});

test("a lost battle costs an ember and the opponent stays; the last ember ends the run and leaves cards behind", () => {
  let fights = 0;
  const { run } = play("paladin", 7, { outcome: () => (++fights > 3 ? "e" : "p") });
  assert.equal(run.step, "lost");
  assert.equal(run.falls, D.dungeon.embers);
  assert.equal(run.embers, 0);
  assert.equal(run.wins, 3);
  assert.ok(run.left.length >= 1 && run.left.length <= D.dungeon.pawned);
  const starter = D.dungeon.starters.paladin;
  for (const id of run.left) assert.ok(run.deck.filter((x) => x === id).length > starter.filter((x) => x === id).length, id + " was gathered on the way");
  // one fall: back before the same opponent, an ember gone, the blessings spent
  let r = play("ranger", 7, { until: (x) => x.step === "battle" }).run;
  r = { ...r, boons: ["b_vigil"] };
  const foe = r.foe, fallen = ok(R.resolve(D, r, "draw"));
  assert.equal(fallen.step, "encounter");
  assert.equal(fallen.foe, foe);
  assert.equal(fallen.embers, D.dungeon.embers - 1);
  assert.ok(fallen.fell);
  assert.deepEqual(fallen.boons, []);
  assert.equal(ok(R.engage(D, fallen)).step, "battle");
});

test("opponents: rivals cut down early, bosses scaled, the pawnbroker plays what the last run lost", () => {
  const rival = R.foe(D, 1, "rival:" + D.archetypes[0].id);
  assert.equal(rival.hp, 10);
  assert.equal(rival.deck.length, 10);
  assert.equal(rival.name, D.archetypes[0].person);
  const queen = R.foe(D, 6, "queen"), boss = D.bosses.find((b) => b.id === "queen");
  assert.equal(queen.hp, Math.round(boss.hp * D.dungeon.tiers[5].bossHp));
  assert.equal(queen.deck.length, boss.deck.length * 2);
  assert.equal(R.foe(D, 1, "fuse").deck.length, D.dungeon.tiers[0].bossCards);
  assert.equal(R.foe(D, 8, "rival:" + D.archetypes[0].id), null, "no rivals at the root sea");
  assert.equal(R.foe(D, 12, "queen"), null);
  const plain = R.foe(D, 2, "pawnbroker"), loaded = R.foe(D, 2, "pawnbroker", { pawned: ["dragon", "fireball", "no-such"] });
  assert.equal(loaded.deck.length, plain.deck.length + 2);
  // a run that carries pawned cards may meet him in the first act
  let met = 0;
  for (let seed = 1; seed <= 30; seed++)
    if (R.create(D, "mage", seed * 31, { pawned: ["dragon"] }).map.rows.flat().some((n) => n.foe === "pawnbroker")) met++;
  assert.ok(met > 0);
});

test("refused steps change nothing", () => {
  const r = R.create(D, "mage", 11);
  assert.ok(R.travel(D, r, 0).error, "the intro is read first");
  assert.ok(R.resolve(D, r, "p").error);
  assert.ok(R.takeBundle(D, r, 0).error);
  assert.ok(R.buy(D, r, 0).error);
  assert.ok(R.rest(D, r, "kindle").error);
  assert.ok(R.create(D, "nobody", 1).error);
  const map = R.begin(D, r);
  assert.equal(r.step, "intro", "steps return a new run");
  assert.ok(R.travel(D, map, 9).error);
  const there = ok(R.travel(D, map, 0));
  assert.equal(there.step, "encounter");
  assert.ok(R.travel(D, there, 0).error, "no walking on before the place is done");
  assert.ok(R.engage(D, there, 5).error);
});

test("choices: needs are checked, effects are carried out and listed, another hero's way is not shown", () => {
  const base = play("mage", 3, { until: (x) => x.step === "map" }).run;
  const stand = (heroId, foe, extra = {}) => ({ ...base, heroId, deck: [...D.dungeon.starters[heroId]], step: "encounter", at: { row: 0, col: 0 }, foe, tier: 2, ...extra });
  // red scarf: the ledger opens a way past her
  let r = stand("mage", "redscarf");
  assert.equal(R.choices(D, r)[0].open, false);
  assert.ok(R.engage(D, r, 0).error);
  r = R.engage(D, stand("mage", "redscarf", { flags: ["ledger"] }), 0);
  assert.ok(!r.error);
  assert.ok(r.relics.includes("banner") && r.pages.includes("p_strike") && r.seen.includes("redscarf"));
  assert.equal(r.wins, 0, "a battle avoided is no win");
  assert.match(r.note.say, /名单|名字/);
  assert.deepEqual(r.note.gains.map((g) => g.kind), ["relic", "page"]);
  // the early riser: only the forest's keeper may sit and wait
  assert.equal(R.choices(D, stand("mage", "earlyriser")).length, 0);
  const calm = R.engage(D, stand("ranger", "earlyriser"), 0);
  assert.ok(calm.deck.includes("earlyroar") && R.legalDeck(D, calm.deck, "ranger"), "a trophy is legal in a run's deck");
  // the appraiser's toll
  assert.ok(R.engage(D, stand("mage", "appraiser", { gold: 10 }), 0).error);
  assert.equal(R.engage(D, stand("mage", "appraiser", { gold: 50 }), 0).gold, 15);
  // the keeper of the root walks on only with the gardener's heir
  const after = (heroId) => R.choices(D, stand(heroId, "frost", { step: "aftermath" })).map((c) => c.label);
  assert.equal(after("mage").length, 3);
  assert.equal(after("paladin").length, 2);
  // embers never pass the full count; a cost that would take the last one is refused by its need
  const cracked = { ...base, step: "event", offer: { event: "cracked" }, at: { row: 1, col: 0 }, embers: 1 };
  assert.equal(R.choices(D, cracked)[0].open, false);
  const full = R.choose(D, { ...base, step: "event", offer: { event: "resin" }, at: { row: 1, col: 0 } }, 0);
  assert.equal(full.embers, D.dungeon.embers);
});

test("picking cards: struck, copied and redeemed; a pick can be left", () => {
  const base = play("mage", 3, { until: (x) => x.step === "map" }).run;
  const at = (event, extra = {}) => ({ ...base, step: "event", offer: { event }, at: { row: 1, col: 0 }, ...extra });
  let r = ok(R.choose(D, at("resin"), 1));
  assert.equal(r.step, "pick");
  assert.equal(r.offer.mode, "copy");
  const copied = ok(R.pickCard(D, r, "spark"));
  assert.equal(copied.deck.filter((x) => x === "spark").length, base.deck.filter((x) => x === "spark").length + 1);
  assert.equal(copied.step, "map");
  r = ok(R.rest(D, { ...base, step: "chapel" }, "forget"));
  assert.equal(r.offer.count, 2);
  const one = ok(R.pickCard(D, r, r.deck[0]));
  assert.equal(one.step, "pick");
  assert.equal(one.offer.count, 1);
  const left = ok(R.pickCard(D, one, null));
  assert.equal(left.step, "map");
  assert.equal(left.deck.length, base.deck.length - 1);
  assert.ok(R.pickCard(D, r, "no-such-card").error);
  // the pawnbroker's tray
  const tray = { ...base, step: "aftermath", foe: "pawnbroker", at: { row: 0, col: 0 }, pawned: ["dragon", "fireball"] };
  const redeem = ok(R.choose(D, tray, R.choices(D, tray).find((c) => c.needs?.pawned).index));
  assert.equal(redeem.offer.mode, "redeem");
  const back = ok(R.pickCard(D, redeem, "fireball"));
  assert.ok(back.deck.includes("fireball"));
  assert.deepEqual(back.pawned, ["dragon"]);
});

test("the chapel and the basket", () => {
  const base = play("mage", 2024, { until: (x) => x.step === "map" }).run;
  assert.ok(R.rest(D, { ...base, step: "chapel" }, "kindle").error, "embers are full");
  assert.equal(ok(R.rest(D, { ...base, step: "chapel", embers: 1 }, "kindle")).embers, 2);
  assert.deepEqual(ok(R.rest(D, { ...base, step: "chapel" }, "vigil")).boons, ["b_vigil"]);
  // the basket: marks buy each card once, a keepsake, and striking a card costs more each time
  let run = play("mage", 2024, { until: (x) => x.step === "shop", way: (x) => x.map.rows[(x.at?.row ?? -1) + 1].findIndex((n) => n.kind === "shop") + 100 }).run;
  if (run.step !== "shop") run = play("mage", 2024, { until: (x) => x.step === "shop", way: () => 2 }).run;
  assert.equal(run.step, "shop");
  run = { ...run, gold: 500 };
  const bought = ok(R.buy(D, run, 0));
  assert.equal(bought.gold, 500 - run.offer.cards[0].price);
  assert.equal(bought.deck.length, run.deck.length + 1);
  assert.ok(R.buy(D, bought, 0).error, "sold");
  const kept = ok(R.buyRelic(D, bought));
  assert.equal(kept.relics.length, bought.relics.length + 1);
  assert.ok(!D.relics.find((x) => x.id === kept.relics.at(-1)).boon, "a blessing is never for sale");
  assert.ok(R.buyRelic(D, kept).error);
  const once = ok(R.remove(D, kept, kept.deck[0]));
  const twice = ok(R.remove(D, once, once.deck[0]));
  assert.equal(once.offer.removePrice, kept.offer.removePrice + D.dungeon.prices.removeStep);
  assert.equal(twice.removals, 2);
  assert.ok(R.remove(D, { ...twice, deck: twice.deck.slice(0, 5) }, twice.deck[0]).error);
  assert.ok(R.remove(D, { ...twice, gold: 0 }, twice.deck[0]).error);
  assert.ok(R.remove(D, twice, "no-such-card").error);
  assert.equal(ok(R.leave(D, twice)).step, "map");
});

test("marks: the tier's prize, more from a named opponent, more with the appraiser's scale", () => {
  const before = play("mage", 8, { until: (x) => x.step === "battle" }).run;
  const G = D.dungeon.gold;
  const won = R.resolve(D, before, "p");
  assert.equal(won.gold, G.base + G.perTier * 1, "a first-row fight pays the plain prize");
  assert.equal(R.resolve(D, { ...before, relics: ["scale"] }, "p").gold, won.gold + D.relics.find((r) => r.id === "scale").bounty);
  assert.equal(won.note.gains[0].kind, "gold");
  assert.equal(won.note.say, R.telling(D, before).fall);
});

test("stored runs are checked: a foreign card, an unknown relic, a blessing among the relics, a broken map", () => {
  const run = R.create(D, "mage", 3);
  assert.ok(R.valid(run, D));
  const foreign = D.cards.find((c) => !c.token && c.class === "paladin").id;
  assert.ok(!R.valid({ ...run, deck: [...run.deck, foreign] }, D));
  assert.ok(!R.valid({ ...run, relics: ["nothing"] }, D));
  assert.ok(!R.valid({ ...run, relics: ["b_vigil"] }, D));
  assert.ok(!R.valid({ ...run, step: "battle" }, D), "a battle needs a place and an opponent");
  assert.ok(!R.valid({ ...run, map: { rows: run.map.rows.slice(1) } }, D));
  assert.ok(!R.valid({ ...run, embers: 9 }, D));
  assert.ok(!R.valid({ ...run, version: 1 }, D));
  assert.ok(!R.valid(null, D));
});

test("the engine starts a run battle: the run's deck and blessings, the foe's health and deck, the player first", () => {
  const run = play("mage", 8, { until: (x) => x.step === "battle" }).run;
  const f = R.foeOf(D, run), id = run.foe;
  const g = new Game();
  assert.ok(g.start("mage", 0, ["b_vigil"], run.deck, 17, { run: { level: run.tier, foe: id }, contracts: [] }).ok);
  assert.equal(g.s.mode, "run");
  assert.deepEqual(g.s.run, { level: 1, foe: id });
  assert.equal(g.s.first, "p");
  assert.equal(g.s.p.armor, 6, "the vigil's blessing");
  assert.equal(g.s.e.hp, f.hp);
  assert.equal(g.s.e.deck.length + g.s.e.hand.length - 1, f.deck.length, "the foe's deck and hand, plus the coin");
  assert.equal(g.s.p.deck.length + g.s.p.hand.length, 10);
  assert.equal(g.s.opponentHero, f.hero);
  assert.ok(State.valid(g.s, D));
  assert.ok(!State.valid({ ...g.s, run: { level: 1, foe: "nobody" } }, D));
  assert.ok(!State.valid({ ...g.s, first: "e" }, D));
  // a deck of the wrong class and an unknown foe are refused; a trophy is welcome
  assert.ok(!g.start("mage", 0, [], ["squire"], 1, { run: { level: 1, foe: id } }).ok);
  assert.ok(!new Game().start("mage", 0, [], run.deck, 1, { run: { level: 1, foe: "nobody" } }).ok);
  assert.ok(new Game().start("mage", 0, [], [...run.deck, "fusecord"], 1, { run: { level: 1, foe: id } }).ok);
  // the pawnbroker's deck carries the pawned cards into the battle
  const p = new Game();
  assert.ok(p.start("mage", 0, [], run.deck, 3, { run: { level: 2, foe: "pawnbroker", pawned: ["dragon"] } }).ok);
  assert.deepEqual(p.s.run.pawned, ["dragon"]);
  assert.equal(p.s.e.deck.length + p.s.e.hand.length - 1, R.foe(D, 2, "pawnbroker").deck.length + 1);
  assert.ok(State.valid(p.s, D));
});

test("a boss met on the descent keeps its power, with scaled health", () => {
  const g = new Game();
  assert.ok(g.start("paladin", 0, [], D.dungeon.starters.paladin, 5, { run: { level: 8, foe: "dragon" } }).ok);
  const dragon = D.bosses.findIndex((b) => b.id === "dragon");
  assert.equal(g.s.bossIndex, dragon);
  assert.equal(g.s.e.hp, Math.round(D.bosses[dragon].hp * D.dungeon.tiers[7].bossHp), "the last boss, by its tier");
  assert.ok(g.s.e.hp >= D.bosses[dragon].hp, "never weaker than he is");
  assert.equal(g.s.opponentHero, undefined);
  assert.ok(State.valid(g.s, D));
});

test("covenant devotion carries from battle to battle, the hunt's turn count does not", () => {
  const g = new Game();
  const devotion = { spells: ["spark", "bolt"], shields: 2, hunts: 3, huntTurn: 4, huntCount: 1 };
  const run = play("mage", 9, { until: (x) => x.step === "battle" }).run;
  g.start("mage", 0, [], run.deck, 9, { run: { level: 1, foe: run.foe, devotion } });
  assert.deepEqual(g.s.p.devotion, { spells: ["spark", "bolt"], shields: 2, hunts: 3, huntTurn: 0, huntCount: 0 });
  assert.deepEqual(R.resolve(D, run, "p", g.s.p.devotion).devotion.spells, ["spark", "bolt"]);
});

test("a run battle plays to its end and every state on the way is a valid save", () => {
  const run = play("ranger", 77, { until: (x) => x.step === "battle" }).run;
  const g = new Game();
  g.start("ranger", 0, [], run.deck, 77, { run: { level: run.tier, foe: run.foe } });
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

test("every keepsake and blessing works in a battle", () => {
  for (const r of D.relics) {
    const g = new Game();
    assert.ok(g.start("paladin", 0, [r.id], null, 5).ok, r.id);
    assert.ok(r.text.length > 0);
  }
});

test("the chronicle: pages and opponents are kept, a lost run pawns its cards, a sealed root opens the way on", () => {
  let c = C.fresh();
  assert.ok(C.valid(c, D));
  assert.deepEqual(C.carry(c, "mage"), { pawned: [], epilogue: false });
  assert.match(C.greeting(c, D)[0], /新面孔/);
  // a run on its way
  const going = play("mage", 21, { until: (x) => x.wins === 2 && x.step === "map" }).run;
  assert.ok(C.news(c, going).includes("p_bounty"));
  c = C.absorb(c, going);
  assert.deepEqual(C.news(c, going), []);
  assert.equal(c.runs, 0);
  // lost in the first act
  let fights = 0;
  const lost = play("mage", 21, { outcome: () => (++fights > 2 ? "e" : "p") }).run;
  c = C.close(c, lost, D);
  assert.ok(C.valid(c, D));
  assert.equal(c.runs, 1);
  assert.deepEqual(c.pawned, lost.left);
  assert.equal(c.last.outcome, "lost");
  assert.equal(C.close(c, lost, D).runs, 1, "a run is counted once");
  assert.match(C.greeting(c, D)[0], /拦得住你一次/);
  assert.ok(!C.greeting(c, D)[0].includes("{foe}"));
  assert.deepEqual(C.carry(c, "mage"), { pawned: lost.left, epilogue: false });
  // the next run redeems nothing and wins: the pawned cards wait, the bearer's page is written, the way on opens —
  // for the bearer who sealed it; another bearer's own first descent is still to come
  const won = play("mage", 22, {}, C.carry(c, "mage")).run;
  c = C.close(c, won, D);
  assert.equal(c.clears.mage, 1);
  assert.ok(c.pages.includes("p_end_mage") && c.pages.includes("p_eve"));
  assert.equal(C.carry(c, "mage").epilogue, true);
  assert.equal(C.carry(c, "paladin").epilogue, false);
  assert.equal(c.mirror, 0);
  assert.match(C.greeting(c, D).join(""), /另一边敲/);
  const beyond = play("mage", 23, {}, C.carry(c, "mage")).run;
  c = C.close(c, beyond, D);
  assert.equal(c.mirror, 1);
  assert.ok(c.pages.includes("p_amara") && c.pages.includes("p_othereve"));
  assert.match(C.greeting(c, D).join(""), /从琥珀里走出来/);
  assert.ok(C.valid(c, D));
  assert.ok(!C.valid({ ...c, pages: ["nothing"] }, D));
  assert.ok(!C.valid({ ...c, version: 0 }, D));
});
