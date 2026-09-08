const test = require("node:test"),
  assert = require("node:assert/strict");
const D = require("../src/data.js"),
  { Game } = require("../src/engine.js"),
  State = require("../src/rules/state.js"),
  Contracts = require("../src/rules/contracts.js");
function game(hero = "morla") {
  const g = new Game();
  assert.equal(
    g.start(hero, 0, [], null, 91, { opponent: "mage_frost", first: "p" }).ok,
    true,
  );
  g.mulligan();
  g.s.p.board = [];
  g.s.e.board = [];
  g.s.p.mana = g.s.p.maxMana = 10;
  return g;
}
function death(g, id) {
  const m = g.summon("p", id);
  m.hp = 0;
  g.cleanup();
  return m;
}
function ready(g) {
  g.s.p.fallen = 8;
  g.s.p.souls = ["wolf", "moonfox", "duskstag", "soulguide"];
}
test("sacrifice is a targeted paid action; deathrattle resolves once and non-token souls are distinct", () => {
  const g = game(),
    m = g.summon("p", "wolf");
  const hand = g.s.p.hand.length;
  assert.equal(
    g.dispatch({ type: "power", side: "p", target: { side: "e", uid: "hero" } })
      .ok,
    false,
  );
  assert.equal(g.s.p.mana, 10);
  assert.equal(g.s.p.powerUsed, false);
  assert.equal(
    g.dispatch({ type: "power", side: "p", target: { side: "p", uid: m.uid } })
      .ok,
    true,
  );
  assert.equal(g.s.p.mana, 8);
  assert.equal(g.s.p.hand.length, hand + 1);
  assert.deepEqual(g.s.p.souls, ["wolf"]);
  assert.equal(g.s.p.fallen, 1);
  assert.deepEqual(
    g.s.p.board.map((m) => m.cid),
    ["pup"],
  );
  death(g, "wolf");
  death(g, "pup");
  assert.deepEqual(g.s.p.souls, ["wolf"]);
  assert.equal(g.s.p.fallen, 2);
});
test("silenced deaths still leave souls; transforms record the form that actually died", () => {
  const g = game();
  const a = g.summon("p", "soulguide");
  g.silence(a);
  const n = g.s.p.hand.length;
  a.hp = 0;
  g.cleanup();
  assert.equal(g.s.p.hand.length, n);
  assert.deepEqual(g.s.p.souls, ["soulguide"]);
  const b = g.summon("p", "wolf");
  g.transform({ side: "p", uid: b.uid }, "sheep");
  g.s.p.board.find((x) => x.uid === b.uid).hp = 0;
  g.cleanup();
  assert.equal(g.s.p.fallen, 1);
});
test("contract validation rejects duplicates, cross-class, main-deck cards, and oversized loadouts atomically", () => {
  const g = game(),
    before = g.snapshot();
  for (const contracts of [
    ["selmyra", "selmyra"],
    ["wolf"],
    ["eclipsewolf", "moonguard", "selmyra", "wolf"],
  ]) {
    assert.equal(g.start("morla", 0, [], null, 1, { contracts }).ok, false);
    assert.deepEqual(g.snapshot(), before);
  }
  assert.equal(
    g.start("mage", 0, [], null, 1, { contracts: ["selmyra"] }).ok,
    false,
  );
  assert.equal(Contracts.check(D, ["selmyra"], "ranger"), true);
  assert.equal(
    g.validateDeck([...D.heroes[0].deck.slice(1), "selmyra"], "morla"),
    false,
  );
});
test("contracts consume ordered distinct souls and mana once; consuming marks is not a death", () => {
  const g = game();
  ready(g);
  const before = g.s.p.hand.length;
  assert.equal(
    g.dispatch({ type: "contract", side: "p", cid: "moonguard" }).ok,
    true,
  );
  assert.deepEqual(g.s.p.souls, ["duskstag", "soulguide"]);
  assert.equal(g.s.p.fallen, 8);
  assert.equal(g.s.p.mana, 5);
  assert.equal(g.s.p.hand.length, before);
  assert.deepEqual(g.s.p.usedContracts, ["moonguard"]);
  const s = g.snapshot();
  assert.equal(
    g.dispatch({ type: "contract", side: "p", cid: "moonguard" }).ok,
    false,
  );
  assert.deepEqual(g.snapshot(), s);
});
test("all unmet gates reject without mutation and god competes for the same spent resources", () => {
  for (const setup of [
    (g) => {},
    (g) => {
      ready(g);
      g.s.p.mana = 8;
    },
    (g) => {
      ready(g);
      for (let i = 0; i < 7; i++) g.summon("p", "guard");
    },
    (g) => {
      ready(g);
      g.s.active = "e";
    },
    (g) => {
      ready(g);
      g.s.choice = { side: "p", cards: ["bolt", "nova", "storm"] };
    },
  ]) {
    const g = game();
    setup(g);
    const before = g.snapshot();
    assert.equal(
      g.dispatch({ type: "contract", side: "p", cid: "selmyra" }).ok,
      false,
    );
    assert.deepEqual(g.snapshot(), before);
  }
  const g = game();
  ready(g);
  g.dispatch({ type: "contract", side: "p", cid: "moonguard" });
  g.s.p.mana = 10;
  assert.match(g.legalContract("p", "selmyra"), /印记/);
});
test("divine arrival is once per match, cannot immediately hit hero even with charge, and respects board capacity", () => {
  const g = game();
  ready(g);
  for (let i = 0; i < 5; i++) g.summon("p", "guard");
  const result = g.dispatch({ type: "contract", side: "p", cid: "selmyra" });
  assert.equal(result.ok, true);
  assert.equal(g.s.p.board.length, 7);
  assert.equal(
    result.events.filter((e) => e.type === "contract" && e.divine).length,
    1,
  );
  const god = g.s.p.board.find((m) => m.cid === "selmyra");
  god.tags.push("charge");
  assert.equal(
    g.attackTargets("p", god.uid).some((t) => t.uid === "hero"),
    false,
  );
  god.tags.push("reborn");
  god.hp = 0;
  g.cleanup();
  assert.equal(
    g.s.p.board.some((m) => m.cid === "selmyra"),
    false,
  );
  ready(g);
  g.s.p.mana = 10;
  assert.match(g.legalContract("p", "selmyra"), /已使用/);
});
test("current contract state survives JSON restore; malformed and obsolete states fail", () => {
  const g = game();
  ready(g);
  g.dispatch({ type: "contract", side: "p", cid: "moonguard" });
  const s = JSON.parse(JSON.stringify(g.s));
  assert.equal(new Game().restore(s), true);
  for (const change of [
    (s) => (s.version = 2),
    (s) => delete s.p.souls,
    (s) => (s.p.souls = ["wolf", "wolf"]),
    (s) => (s.p.souls = ["pup"]),
    (s) => (s.p.usedContracts = ["selmyra", "selmyra"]),
    (s) => (s.p.contracts = ["bolt"]),
    (s) => (s.p.fallen = -1),
  ]) {
    const bad = structuredClone(s);
    change(bad);
    assert.equal(State.valid(bad, D), false);
  }
});
test("AI plans legal contract summons from public information and never modifies the original", () => {
  const g = game();
  ready(g);
  g.s.p.hand = [];
  g.s.e.board = [];
  g.summon("e", "guard");
  const before = g.snapshot();
  const action = g.trainingAction("p", { budget: 160 });
  assert.equal(action.type, "contract");
  assert.deepEqual(g.snapshot(), before);
  assert.equal(g.dispatch(action).ok, true);
});

test("contract cards cannot bypass their costs through hand play or restored main decks", () => {
  const g = game();
  ready(g);
  const c = g.card("selmyra");
  g.s.p.hand = [c];
  const before = g.snapshot();
  assert.equal(g.dispatch({ type: "play", side: "p", uid: c.uid }).ok, false);
  assert.deepEqual(g.snapshot(), before);
  assert.equal(State.valid(g.s, D), false);
  g.s.p.hand = [];
  g.s.p.deck = [c];
  assert.equal(State.valid(g.s, D), false);
});
