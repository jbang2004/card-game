const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/data.js");
const cards = require("../src/content/cards.js");
const campaign = require("../src/content/campaign.js");
const { Game } = require("../src/engine.js");
const Rules = require("../src/rules/decks.js");
const Store = require("../src/application/decks.js");
const Storage = require("../src/platform/storage.js");
function alternate() {
  const world = structuredClone(campaign);
  world.heroes.push({
    ...structuredClone(world.heroes[0]),
    id: "arcanist",
    name: "第二位法师",
  });
  return world;
}
test("two heroes share a class/preset while retaining distinct powers, discovery and restore identity", () => {
  const world = alternate();
  world.heroes.at(-1).powerEffects[0].amount = 3;
  world.archetypes.push({
    ...structuredClone(world.archetypes[0]),
    id: "arcanist_burn",
    hero: "arcanist",
  });
  const data = D.create(cards, world),
    g = new Game({ data });
  assert.ok(
    g.start("arcanist", 0, [], data.heroes[0].deck, 4242, {
      opponent: "arcanist_burn",
    }).ok,
  );
  g.mulligan();
  g.s.active = "p";
  g.s.p.mana = 10;
  assert.equal(g.classFor("p"), "mage");
  assert.equal(g.classFor("e"), "mage");
  const hp = g.s.e.hp;
  assert.ok(g.power("p", { side: "e", uid: "hero" }).ok);
  assert.equal(g.s.e.hp, hp - 3);
  g.resolve([{ type: "discover", count: 3, cardType: "spell" }], {
    side: "p",
    card: data.byId.discovery,
  });
  assert.ok(
    g.s.choice.cards.every((id) =>
      ["neutral", "mage"].includes(data.byId[id].class),
    ),
  );
  const restored = new Game({ data });
  assert.ok(restored.restore(g.s));
  assert.equal(restored.s.heroId, "arcanist");
  assert.equal(restored.powerDefinition("e").id, "arcanist");
});
test("new class and tribe register through content without engine edits", () => {
  const world = structuredClone(campaign),
    defs = structuredClone(cards);
  world.classes.push({ id: "druid", name: "德鲁伊" });
  world.tribes.push({ id: "elemental", name: "元素" });
  for (const c of defs) if (c.class === "mage") c.class = "druid";
  defs.find((c) => c.id === "spark").tribe = "elemental";
  world.heroes[0].classId = "druid";
  for (const a of world.archetypes)
    if (a.classId === "mage") a.classId = "druid";
  const data = D.create(defs, world),
    g = new Game({ data });
  assert.equal(data.classNames.druid, "德鲁伊");
  assert.ok(g.start("mage").ok);
  assert.ok(Rules.canInclude(data, data.byId.spark, "mage"));
  assert.equal(g.classFor("p"), "druid");
});
test("content rejects duplicated identities, typos, invalid defaults and invalid targeted skills", () => {
  const mutations = [
    (w) => w.heroes.push(structuredClone(w.heroes[0])),
    (w) => w.bosses.push(structuredClone(w.bosses[0])),
    (w) => w.relics.push(structuredClone(w.relics[0])),
    (w) => w.archetypes.push(structuredClone(w.archetypes[0])),
    (w) => w.classes.push(structuredClone(w.classes[0])),
    (w) => (w.heroes[0].powerCots = 9),
    (w) => (w.relics[0].maxHeath = 8),
    (w) => delete w.heroes[0].target,
    (w) => (w.heroes[0].target = "anything"),
    (w) => (w.heroes[0].powerEffects = [{ type: "destroy", to: "selected" }]),
    (w) => (w.heroes[0].defaultDeckId = "missing"),
    (w) => (w.heroes[0].defaultDeckId = "ranger_pack"),
    (w) => (w.heroes[0].deck = ["spark"]),
    (w) => (w.archetypes[0].deck = ["spark"]),
    (w) => (w.archetypes[0].deck[0] = "tracking"),
    (w) => (w.bosses[0].hp = -1),
    (w) => (w.bosses[0].deck = ["missing"]),
    (w) =>
      (w.bosses[0].phaseEffects = [
        { type: "damage", amount: 1, to: "selected" },
      ]),
    (w) =>
      (w.relics[0].onTurn = [
        { type: "buff", to: "self", attack: 1, health: 1 },
      ]),
    (w) => (w.relics[0].startingMana = 11),
    (w) => (w.deckRules.szie = 20),
  ];
  for (const mutate of mutations) {
    const w = structuredClone(campaign);
    mutate(w);
    assert.throws(() => D.create(cards, w), String(mutate));
  }
});
test("deck size and copy limits have one policy across authored decks and engine", () => {
  const world = structuredClone(campaign);
  world.deckRules = { size: 20, maxCopies: 3, rarityCopies: { legendary: 2 } };
  for (const a of world.archetypes) a.deck = a.deck.slice(0, 20);
  const data = D.create(cards, world),
    g = new Game({ data });
  const deck = [...data.heroes[0].deck];
  deck[2] = "spark";
  assert.ok(Rules.check(data, deck, "mage").ok);
  assert.ok(g.validateDeck(deck, "mage"));
  assert.ok(g.start("mage", 0, [], deck).ok);
  assert.equal(g.s.p.deck.length + g.s.p.hand.length, 20);
  assert.equal(new Game().validateDeck(deck, "mage"), false);
  assert.equal(g.validateDeck(deck, "missing"), false);
});
test("combined relic metadata describes every applied effect", () => {
  const world = structuredClone(campaign);
  world.relics[0].spellDamage = 2;
  world.relics[0].onStart = [{ type: "armor", amount: 3 }];
  const data = D.create(cards, world);
  assert.match(data.relics[0].text, /最大生命值 \+8/);
  assert.match(data.relics[0].text, /额外造成 2/);
  assert.match(data.relics[0].text, /3 点护甲/);
});
test("appending a boss preserves old indices; invalid starts leave state untouched", () => {
  const world = structuredClone(campaign);
  world.bosses.push({ ...structuredClone(world.bosses[0]), id: "sixth" });
  const data = D.create(cards, world),
    g = new Game({ data });
  assert.ok(g.start("mage", world.bosses.length - 1).ok);
  assert.equal(g.powerDefinition("e").id, "sixth");
  assert.ok(new Game({ data }).restore(g.s));
  const before = JSON.stringify(g.s);
  for (const args of [
    ["missing"],
    ["mage", world.bosses.length],
    ["mage", 0, ["missing"]],
    ["mage", 0, ["heart", "heart"]],
  ]) {
    assert.equal(g.start(...args).ok, false);
    assert.equal(JSON.stringify(g.s), before);
  }
});
function memory(raw = null) {
  let value = raw === null ? null : JSON.stringify(raw),
    writes = 0,
    fail = false;
  const adapter = Storage.create(() => ({
    getItem: () => value,
    setItem: (_, v) => {
      if (fail) throw Error("quota");
      value = v;
      writes++;
    },
  }));
  const store = Store.create({
    data: D,
    read: adapter.readResult,
    write: adapter.write,
  });
  return {
    store,
    raw: () => value,
    writes: () => writes,
    fail: () => (fail = true),
    corrupt: (v) => (value = v),
  };
}
test("named collections survive reload without losing other decks", () => {
  const original = [...D.heroes[0].deck],
    m = memory();
  const first = m.store.load();
  assert.ok(first.ok);
  assert.equal(first.collection.decks.length, 0);
  assert.equal(m.writes(), 0);
  assert.equal(m.raw(), null);
  const one = m.store.save({
    name: "我的法师",
    heroId: "mage",
    cards: original,
  });
  assert.ok(one.ok);
  const two = m.store.save({
    name: "我的游侠",
    heroId: "ranger",
    cards: D.heroes[2].deck,
  });
  assert.ok(two.ok);
  const loaded = Store.decode(JSON.parse(m.raw()), D);
  assert.equal(loaded.decks.length, 2);
  assert.equal(loaded.activeId, two.record.id);
  assert.deepEqual(loaded.decks[0].cards, original);
  two.record.cards.pop();
  assert.equal(JSON.parse(m.raw()).decks[1].cards.length, 30);
  assert.ok(
    m.store.save({
      id: one.record.id,
      name: "改名法师",
      heroId: "mage",
      cards: original,
    }).ok,
  );
  assert.equal(m.store.load().collection.decks.length, 2);
});
test("obsolete arrays are rejected and can be explicitly replaced with an empty collection", () => {
  const m = memory(D.heroes[0].deck);
  assert.equal(m.store.load().ok, false);
  assert.equal(m.writes(), 0);
  assert.ok(m.store.reset().ok);
  assert.deepEqual(m.store.load().collection, {
    version: 3,
    activeId: null,
    decks: [],
  });
});
test("failed writes, broken JSON and unknown versions never overwrite collections or report success", () => {
  const m = memory(),
    draft = { name: "测试", heroId: "mage", cards: D.heroes[0].deck };
  const before = m.raw();
  m.fail();
  assert.equal(m.store.save(draft).ok, false);
  assert.equal(m.raw(), before);
  for (const raw of [
    "{broken",
    JSON.stringify({ version: 99, decks: [] }),
    JSON.stringify({ version: 3, activeId: "ghost", decks: [] }),
  ]) {
    const n = memory();
    n.corrupt(raw);
    assert.equal(n.store.load().ok, false);
    assert.equal(n.store.save(draft).ok, false);
    assert.equal(n.raw(), raw);
  }
});
