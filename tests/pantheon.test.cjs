const test = require("node:test"),
  assert = require("node:assert/strict");
const D = require("../src/data.js"),
  { Game } = require("../src/engine.js"),
  C = require("../src/rules/contracts.js"),
  State = require("../src/rules/state.js");
function game(hero = "mage") {
  const g = new Game();
  g.start(hero, 0, [], null, 812, { opponent: "mage_frost", first: "p" });
  g.mulligan();
  g.s.turn = 9;
  g.s.active = "p";
  g.s.p.board = [];
  g.s.e.board = [];
  g.s.p.mana = g.s.p.maxMana = 10;
  return g;
}
function play(g, id, target) {
  g.s.p.mana = 10;
  const c = g.card(id);
  g.s.p.hand = [c];
  return g.dispatch({ type: "play", side: "p", uid: c.uid, target });
}
function ready(g, id) {
  const r = D.byId[id].contract.ritual;
  g.s.p.devotion[r.kind] =
    r.kind === "spells"
      ? ["bolt", "frostbolt", "nova", "wisdom", "starweave", "fireball"]
      : r.amount;
}
test("all heroes have one distinct default deity; class pool still shared and at most one deity", () => {
  const gods = D.heroes.map((h) =>
    h.defaultContracts.filter((id) => D.byId[id].contract.divine),
  );
  assert.deepEqual(gods, [["jingchen"], ["aurion"], ["fenlos"], ["selmyra"]]);
  assert.equal(C.check(D, ["selmyra", "fenlos"], "ranger"), false);
  assert.equal(C.check(D, ["fenlos"], "ranger"), true);
  for (const h of D.heroes)
    assert.equal(new Game().start(h.id, 0, [], null, 1).ok, true);
});
test("starfire counts successful distinct non-token spells, not duplicates, counters, or power", () => {
  const g = game();
  const enemy = { side: "e", uid: "hero" };
  assert.equal(play(g, "bolt", enemy).ok, true);
  assert.equal(play(g, "bolt", enemy).ok, true);
  assert.deepEqual(g.s.p.devotion.spells, ["bolt"]);
  g.s.e.secrets = ["counterspell"];
  assert.equal(play(g, "frostbolt", enemy).ok, true);
  assert.deepEqual(g.s.p.devotion.spells, ["bolt"]);
  play(g, "coin");
  g.s.p.mana = 10;
  g.dispatch({ type: "power", side: "p", target: enemy });
  assert.deepEqual(g.s.p.devotion.spells, ["bolt"]);
  assert.equal(g.s.e.devotion.spells.length, 0);
});
test("dawn requires actual enemy damage breaking a shield, excluding self damage, silence and zero damage", () => {
  const g = game("paladin");
  const m = g.summon("p", "squire");
  g.damage("p", m.uid, 0, { side: "e", uid: "hero" });
  assert.equal(g.s.p.devotion.shields, 0);
  g.damage("p", m.uid, 1, { side: "p", uid: "hero" });
  assert.equal(g.s.p.devotion.shields, 0);
  m.tags.push("shield");
  g.silence(m);
  assert.equal(g.s.p.devotion.shields, 0);
  m.tags.push("shield");
  g.damage("p", m.uid, 1, { side: "e", uid: "hero" });
  assert.equal(g.s.p.devotion.shields, 1);
  g.damage("p", m.uid, 1, { side: "e", uid: "hero" });
  assert.equal(g.s.p.devotion.shields, 1);
});
test("hunt requires proactive beast combat, caps at two per turn, includes mutual deaths, not face or retaliation", () => {
  const g = game("ranger");
  const beast = g.summon("p", "spiritwolf");
  const target = g.summon("e", "colossus");
  target.atk = 0;
  target.hp = target.maxHp = 80;
  const attack = () => {
    beast.attacks = 0;
    beast.summoned = -1;
    return g.dispatch({
      type: "attack",
      side: "p",
      uid: beast.uid,
      target: { side: "e", uid: target.uid },
    });
  };
  for (let i = 0; i < 3; i++) assert.equal(attack().ok, true);
  assert.equal(g.s.p.devotion.hunts, 2);
  g.s.turn++;
  assert.equal(attack().ok, true);
  assert.equal(g.s.p.devotion.hunts, 3);
  target.tags = [];
  beast.attacks = 0;
  beast.tags.push("charge");
  assert.equal(
    g.dispatch({
      type: "attack",
      side: "p",
      uid: beast.uid,
      target: { side: "e", uid: "hero" },
    }).ok,
    true,
  );
  assert.equal(g.s.p.devotion.hunts, 3);
  g.s.active = "e";
  target.tags.push("rush");
  target.attacks = 0;
  target.atk = 10;
  g.dispatch({
    type: "attack",
    side: "e",
    uid: target.uid,
    target: { side: "p", uid: beast.uid },
  });
  assert.equal(g.s.p.devotion.hunts, 3);
  const other = g.summon("p", "spiritwolf");
  g.s.active = "p";
  target.atk = 2;
  assert.equal(
    g.dispatch({
      type: "attack",
      side: "p",
      uid: other.uid,
      target: { side: "e", uid: target.uid },
    }).ok,
    true,
  );
  assert.equal(g.s.p.devotion.hunts, 4);
  assert.equal(
    g.s.p.board.some((m) => m.uid === other.uid),
    false,
  );
});
for (const [hero, id] of [
  ["mage", "jingchen"],
  ["paladin", "aurion"],
  ["ranger", "fenlos"],
]) {
  test(`${id}: all gates atomic, paid once, no immediate hero attacks or resurrection; save and AI`, () => {
    const g = game(hero);
    g.s.p.hand = [];
    const before = g.snapshot();
    assert.equal(
      g.dispatch({ type: "contract", side: "p", cid: id }).ok,
      false,
    );
    assert.deepEqual(g.snapshot(), before);
    ready(g, id);
    g.s.p.mana = 8;
    const low = g.snapshot();
    assert.equal(
      g.dispatch({ type: "contract", side: "p", cid: id }).ok,
      false,
    );
    assert.deepEqual(g.snapshot(), low);
    g.s.p.mana = 10;
    for (let i = 0; i < 7; i++) g.summon("p", "guard");
    const full = g.snapshot();
    assert.equal(
      g.dispatch({ type: "contract", side: "p", cid: id }).ok,
      false,
    );
    assert.deepEqual(g.snapshot(), full);
    g.s.p.board = [];
    g.summon("e", "guard");
    const root = g.snapshot();
    const a = g.trainingAction("p", { budget: 160 });
    assert.deepEqual(g.snapshot(), root);
    assert.equal(a.type, "contract");
    assert.equal(a.cid, id);
    const souls = [...g.s.p.souls];
    assert.equal(g.dispatch(a).ok, true);
    assert.equal(g.s.p.mana, 1);
    assert.deepEqual(g.s.p.souls, souls);
    const god = g.s.p.board.find((m) => m.cid === id);
    god.tags.push("charge");
    assert.equal(
      g.attackTargets("p", god.uid).some((t) => t.uid === "hero"),
      false,
    );
    g.silence(god);
    god.tags.push("charge");
    assert.equal(
      g.attackTargets("p", god.uid).some((t) => t.uid === "hero"),
      false,
    );
    assert.equal(State.valid(g.s, D), true);
    assert.equal(new Game().restore(JSON.parse(JSON.stringify(g.s))), true);
    god.tags.push("reborn");
    god.hp = 0;
    g.cleanup();
    assert.equal(
      g.s.p.board.some((m) => m.cid === id),
      false,
    );
    g.s.p.mana = 10;
    assert.match(g.legalContract("p", id), /已使用/);
  });
}
test("deity effects have bounded triggers, capacity, temporary modifiers and removable defenses", () => {
  const g = game();
  ready(g, "jingchen");
  const target = g.summon("e", "colossus");
  target.hp = target.maxHp = 20;
  g.dispatch({ type: "contract", side: "p", cid: "jingchen" });
  assert.equal(target.hp, 16);
  play(g, "wisdom");
  play(g, "wisdom");
  assert.equal(target.hp, 15);
  g.silence(g.s.p.board[0]);
  g.s.turn++;
  play(g, "wisdom");
  assert.equal(target.hp, 15);
  const p = game("paladin");
  ready(p, "aurion");
  p.s.p.hp = 20;
  const ally = p.summon("p", "guard");
  p.dispatch({ type: "contract", side: "p", cid: "aurion" });
  assert.equal(p.s.p.hp, 24);
  assert.ok(ally.tags.includes("shield"));
  p.silence(p.s.p.board[1]);
  assert.deepEqual(p.s.p.board[1].tags, []);
  const r = game("ranger");
  ready(r, "fenlos");
  for (let i = 0; i < 5; i++) r.summon("p", "guard");
  r.dispatch({ type: "contract", side: "p", cid: "fenlos" });
  assert.equal(r.s.p.board.length, 7);
  const foe = r.summon("e", "guard");
  const god = r.s.p.board.find((m) => m.cid === "fenlos");
  r.dispatch({
    type: "attack",
    side: "p",
    uid: god.uid,
    target: { side: "e", uid: foe.uid },
  });
  const wolf = r.s.p.board.find((m) => m.cid === "spiritwolf");
  assert.equal(wolf.atk, D.byId.spiritwolf.atk + 1);
  r.dispatch({ type: "end", side: "p" });
  assert.equal(wolf.atk, D.byId.spiritwolf.atk);
});
test("devotion is strict current save state; corrupt and missing fields are rejected", () => {
  const g = game();
  assert.equal(State.valid(g.s, D), true);
  for (const bad of [
    null,
    {},
    { ...g.s.p.devotion, shields: -1 },
    { ...g.s.p.devotion, spells: ["coin"] },
    { ...g.s.p.devotion, spells: ["bolt", "bolt"] },
    { ...g.s.p.devotion, hunts: 999 },
    { ...g.s.p.devotion, huntCount: 3 },
  ]) {
    const s = structuredClone(g.snapshot());
    s.p.devotion = bad;
    assert.equal(State.valid(s, D), false);
  }
  const s = structuredClone(g.snapshot());
  delete s.p.devotion;
  assert.equal(new Game().restore(s), false);
});
