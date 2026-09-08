const test = require("node:test"),
  assert = require("node:assert/strict");
const D = require("../src/data.js"),
  { Game } = require("../src/engine.js");
function setup(hero = "mage", boss = 0) {
  const g = new Game();
  g.start(hero, boss, [], null, 7521);
  g.mulligan();
  g.s.p.board = [];
  g.s.e.board = [];
  g.s.p.hand = [];
  g.s.e.hand = [];
  g.s.p.mana = g.s.e.mana = 10;
  return g;
}
function play(g, id, target, side = "p") {
  const c = g.card(id);
  g.s[side].hand.push(c);
  return g.dispatch({ type: "play", side, uid: c.uid, target });
}
const hero = (side) => ({ side, uid: "hero" });
test("eight distinct class-legal archetypes and strict duplicate limits", () => {
  const g = new Game();
  assert.equal(D.archetypes.length, 8);
  for (const a of D.archetypes) {
    assert.ok(g.validateDeck(a.deck, a.hero), a.id);
    assert.ok(D.heroes.some(h=>h.id===a.hero));
  }
  assert.equal(g.validateDeck(D.archetypes[0].deck, "ranger"), false);
});
test("spell engine triggers have turn caps, silence and restore persistence", () => {
  const g = setup();
  const m = g.summon("p", "spark", { sick: false });
  for (let i = 0; i < 4; i++) play(g, "coin");
  assert.equal(m.atk, 4);
  const h = new Game();
  assert.ok(h.restore(g.s));
  play(h, "coin");
  assert.equal(h.s.p.board[0].atk, 4);
  h.silence(h.s.p.board[0]);
  play(h, "coin");
  assert.equal(h.s.p.board[0].atk, 1);
  g.endTurn("p");
  assert.equal(m.atk, 1);
});
test("death engine draws once per turn after simultaneous departures", () => {
  const g = setup("ranger");
  g.summon("p", "necromancer");
  const a = g.summon("p", "wolf"),
    b = g.summon("p", "wolf");
  a.hp = b.hp = 0;
  const n = g.s.p.hand.length;
  g.cleanup();
  assert.equal(g.s.p.hand.length, n + 1);
  assert.equal(g.s.p.board.filter((m) => m.cid === "pup").length, 2);
});
test("counterspell spends card/mana but cancels spell and spell-cast triggers", () => {
  const g = setup();
  g.s.e.secrets = ["counterspell"];
  g.summon("p", "wisp");
  const hp = g.s.e.hp;
  assert.ok(play(g, "fireball", hero("e")).ok);
  assert.equal(g.s.e.hp, hp);
  assert.equal(g.s.p.mana, 6);
  assert.equal(g.s.e.secrets.length, 0);
});
test("barrier and redirect resolve in registration order and full-board ambush stays armed", () => {
  const g = setup();
  const m = g.summon("p", "rider", { sick: false });
  g.s.e.secrets = ["icebarrier", "ambush"];
  g.attack("p", m.uid, hero("e"));
  assert.equal(g.s.e.armor, 8);
  assert.equal(g.s.e.hp, 30);
  assert.equal(g.s.e.secrets.length, 0);
  const h = setup();
  for (let i = 0; i < 7; i++) h.summon("e", "skeleton");
  const n = h.summon("p", "rider", { sick: false });
  h.s.e.secrets = ["ambush"];
  h.attack("p", n.uid, hero("e"));
  assert.deepEqual(h.s.e.secrets, ["ambush"]);
});
test("tracking draws only beasts, preserves other order, and stops without fatigue", () => {
  const g = setup("ranger");
  g.s.p.deck = ["fireball", "wolf", "guard", "rider"].map((id) => g.card(id));
  play(g, "tracking");
  assert.deepEqual(
    g.s.p.hand.map((c) => c.cid),
    ["wolf", "rider"],
  );
  assert.deepEqual(
    g.s.p.deck.map((c) => c.cid),
    ["fireball", "guard"],
  );
  play(g, "tracking");
  assert.equal(g.s.p.fatigue, 0);
});
test("weapon counter destroys weapon and draws without requiring a weapon", () => {
  const g = setup("ranger");
  g.s.e.weapon = { cid: "dagger", atk: 2, durability: 2, tags: [] };
  play(g, "sabotage");
  assert.equal(g.s.e.weapon, null);
  assert.equal(g.s.p.hand.length, 1);
});
test("AI finds the seven-mana eleven-damage lethal instead of using a power", () => {
  const g = setup("mage", 1);
  g.s.active = "e";
  g.s.e.mana = 7;
  g.s.p.hp = 11;
  g.s.e.hand = ["fireball", "frostbolt", "bolt"].map((id) => g.card(id));
  for (let i = 0; i < 3 && g.s.phase === "battle"; i++)
    assert.ok(g.aiStep().ok);
  assert.equal(g.s.winner, "e");
});
test("AI handles divine shield/poison and buffs before windfury attacks", () => {
  const g = setup();
  g.s.active = "e";
  g.s.p.hp = 18;
  g.s.e.mana = 2;
  g.summon("e", "berserker", { sick: false });
  g.s.e.hand = ["blessing", "battlecry", "battlecry"].map((id) => g.card(id));
  for (let i = 0; i < 6 && g.s.phase === "battle" && g.s.active === "e"; i++)
    assert.ok(g.aiStep().ok);
  assert.equal(g.s.winner, "e");
});
test("AI decision never mutates live RNG, state or pending events", () => {
  const g = setup();
  g.s.active = "e";
  g.s.e.hand = ["discovery", "fireball", "oracle"].map((id) => g.card(id));
  const before = JSON.stringify({ s: g.s, e: g.events });
  g.aiAction();
  assert.equal(JSON.stringify({ s: g.s, e: g.events }), before);
});
test("discover options always respect the current class pool", () => {
  const g = setup();
  play(g, "discovery");
  assert.ok(
    g.s.choice.cards.every((id) =>
      ["mage", "neutral"].includes(D.byId[id].class),
    ),
  );
});
test("practice supports both first players, coin after mulligan, class power and no boss phase", () => {
  for (const first of ["p", "e"]) {
    const g = new Game();
    assert.ok(
      g.start("mage", 0, [], D.archetypes[0].deck, 44, {
        opponent: "ranger_pack",
        first,
      }).ok,
    );
    assert.equal(g.s.p.hand.length, first === "p" ? 3 : 4);
    g.mulligan();
    assert.equal(g.s.active, first);
    assert.equal(g.powerDefinition("e").id, "ranger");
    assert.equal(g.s.e.maxHp, 30);
    g.s.e.hp = 12;
    g.cleanup();
    assert.equal(g.s.phase2, false);
    assert.ok(new Game().restore(g.s));
    if (first === "e") assert.ok(g.s.p.hand.some((c) => c.cid === "coin"));
  }
});
test("starting a cross-class deck is always rejected atomically", () => {
  const g = setup();
  const before = JSON.stringify(g.s);
  assert.equal(g.start("paladin", 0, [], D.archetypes[0].deck).ok, false);
  assert.equal(JSON.stringify(g.s), before);
  assert.equal(
    g.start("paladin", 1, [], D.archetypes[0].deck, 44, { legacyDeck: true })
      .ok,
    false,
  );
  assert.equal(JSON.stringify(g.s), before);
});
test("AI values tracking and pending discovery without learning draw order", () => {
  const g = setup("ranger");
  g.s.active = "p";
  g.s.p.mana = 2;
  g.s.p.hand = [g.card("tracking")];
  g.s.p.deck = ["wolf", "fireball", "rider", "guard"].map((id) => g.card(id));
  assert.equal(g.trainingAction().type, "play");
  const before = g.trainingAction();
  g.s.p.deck.reverse();
  assert.deepEqual(g.trainingAction(), before);
  const h = setup();
  h.s.p.mana = 2;
  h.s.p.hand = [h.card("discovery")];
  assert.equal(h.trainingAction().type, "play");
});
