const test = require("node:test"),
  assert = require("node:assert/strict");
const D = require("../src/data.js"),
  definitions = require("../src/content/cards.js"),
  campaign = require("../src/content/campaign.js"),
  { Game } = require("../src/engine.js");
const initial = require("./fixtures/save-current.json");
function setup(data = D) {
  const g = new Game({ data });
  assert.ok(g.restore(initial));
  return g;
}
function card(g, id) {
  const c = g.card(id);
  g.s.p.hand = [c];
  return c;
}
test("all current cards settle deterministically and serialize valid states", () => {
  for (const definition of D.cards) {
    const run = () => {
      if (definition.contract) {
        const g = new Game();
        g.start(
          D.heroes.find((h) => h.classId === definition.class).id,
          0,
          [],
          null,
          91,
          { contracts: [definition.id] },
        );
        g.mulligan();
        g.s.p.mana = g.s.p.maxMana = 10;
        g.s.turn = 9;
        if (definition.contract.ritual) {
          const { kind, amount } = definition.contract.ritual;
          g.s.p.devotion[kind] =
            kind === "spells"
              ? [
                  "bolt",
                  "frostbolt",
                  "nova",
                  "storm",
                  "wisdom",
                  "starweave",
                ].slice(0, amount)
              : amount;
        }
        g.s.p.fallen = 8;
        g.s.p.souls = ["wolf", "moonfox", "duskstag", "soulguide"];
        assert.ok(
          g.dispatch({ type: "contract", side: "p", cid: definition.id }).ok,
        );
        assert.ok(new Game().restore(g.snapshot()), definition.id);
        return g.snapshot();
      }
      const g = setup(),
        c = card(g, definition.id);
      const target = definition.target
        ? g.targets(definition.target, "p")[0]
        : null;
      assert.ok(
        g.dispatch({ type: "play", side: "p", uid: c.uid, target }).ok,
        definition.id,
      );
      assert.ok(new Game().restore(g.snapshot()), definition.id);
      return g.snapshot();
    };
    assert.deepEqual(run(), run(), definition.id);
  }
});
test("current saves restore without state changes", () => {
  const g = setup();
  assert.deepEqual(g.s, initial);
  const h = new Game();
  assert.ok(h.restore(g.snapshot()));
  assert.deepEqual(h.s, g.s);
});
test("changing one battlecry parameter changes execution, wording and preview", () => {
  const defs = structuredClone(definitions);
  defs.find((c) => c.id === "archer").onPlay[0].amount = 2;
  const data = D.create(defs),
    g = setup(data),
    c = card(g, "archer"),
    target = { side: "e", uid: g.s.e.board[0].uid };
  assert.match(data.byId.archer.text, /2 点伤害/);
  assert.equal(g.preview({ type: "card", cid: "archer" }, target).amount, 2);
  g.dispatch({ type: "play", side: "p", uid: c.uid, target });
  assert.equal(g.s.e.board[0].hp, 1);
  assert.equal(D.byId.archer.onPlay[0].amount, 1);
});
test("unknown effects, fields, IDs and invalid references fail before a match", () => {
  for (const mutate of [
    (a) => (a[0].onPlay[0].type = "typo_damage"),
    (a) => (a[0].onPlay[0].ammount = 5),
    (a) => (a[1].id = a[0].id),
    (a) => (a.find((c) => c.id === "wolf").onDeath[0].card = "missing"),
    (a) => (a[0].cost = -1),
    (a) => (a[0].onPlay[0].amount = -1),
  ]) {
    const defs = structuredClone(definitions);
    mutate(defs);
    assert.throws(() => D.create(defs));
  }
});
test("shared token stat changes update both summon and secret descriptions", () => {
  const defs = structuredClone(definitions);
  defs.find((c) => c.id === "stone").atk = 5;
  const d = D.create(defs);
  assert.match(d.byId.ambush.text, /5\/3/);
  assert.match(d.byId.titan.text, /5\/3/);
});
test("commands emit balanced causal blocks and one immutable notification", () => {
  const g = setup();
  let calls = 0,
    notification;
  g.onChange = (state, events) => {
    calls++;
    notification = { state, events };
  };
  const c = card(g, "fireball");
  const r = g.dispatch({
    type: "play",
    side: "p",
    uid: c.uid,
    target: { side: "e", uid: "hero" },
  });
  assert.ok(r.ok);
  assert.equal(calls, 1);
  const stack = [];
  for (const e of r.events) {
    if (e.type === "blockStart") {
      assert.equal(e.parentId, stack.at(-1) || null);
      stack.push(e.id);
    } else if (e.type === "blockEnd") assert.equal(e.blockId, stack.pop());
    else assert.equal(e.parentId, stack.at(-1) || null);
  }
  assert.equal(stack.length, 0);
  assert.ok(Object.isFrozen(notification.state.p));
  assert.ok(Object.isFrozen(notification.events));
});
test("invalid commands leave state and pending events untouched", () => {
  const g = setup(),
    c = card(g, "bolt"),
    s = JSON.stringify(g.s),
    events = JSON.stringify(g.events);
  assert.equal(
    g.dispatch({
      type: "play",
      side: "p",
      uid: c.uid,
      target: { side: "p", uid: "hero" },
    }).ok,
    false,
  );
  assert.equal(JSON.stringify(g.s), s);
  assert.equal(JSON.stringify(g.events), events);
  assert.equal(g.dispatch({ type: "play", side: "bad", uid: c.uid }).ok, false);
});
test("presentation facade cannot mutate rule state or invoke low-level effects", () => {
  const g = setup(),
    view = g.view();
  assert.equal(view.summon, undefined);
  assert.equal(view.dispatch, undefined);
  assert.throws(() => view.s.p.hand.push({}));
  const old = g.s.p.hp;
  view.s.p.hp = 1;
  assert.equal(g.s.p.hp, old);
});
test("preview leaves RNG/state untouched and uses damage shield/armor behavior", () => {
  const g = setup(),
    c = card(g, "frostbolt"),
    target = { side: "e", uid: g.s.e.board[1].uid },
    before = JSON.stringify(g.s);
  const p = g.preview({ type: "card", cid: "frostbolt" }, target);
  assert.ok(p.target.blocked);
  assert.equal(JSON.stringify(g.s), before);
  g.dispatch({ type: "play", side: "p", uid: c.uid, target });
  assert.equal(g.getTarget(target).hp, p.target.hp);
  assert.ok(g.getTarget(target).frozen);
});
test("preview never resolves a hidden secret or random effect", () => {
  const g = setup();
  g.s.e.board = [];
  g.s.e.secrets = ["ambush"];
  const before = JSON.stringify(g.s);
  assert.equal(
    g.preview(
      { type: "attack", uid: g.s.p.board[0].uid },
      { side: "e", uid: "hero" },
    ).kind,
    "uncertain",
  );
  assert.equal(JSON.stringify(g.s), before);
});
test("temporary and permanent modifiers retain provenance and expire independently", () => {
  const g = setup(),
    m = g.s.p.board[0];
  g.buff(m, 2, 2, { source: "permanent" });
  g.buff(m, 3, 0, { source: "temporary", duration: "turn" });
  assert.equal(m.atk, 7);
  g.endTurn("p");
  assert.equal(m.atk, 4);
  assert.deepEqual(
    m.modifiers.map((x) => x.source),
    ["permanent"],
  );
  const h = new Game();
  assert.ok(h.restore(g.s));
  h.silence(h.s.p.board[0]);
  assert.equal(h.s.p.board[0].atk, 2);
  assert.equal(h.s.p.board[0].modifiers.length, 0);
});

test("storage adapter preserves keys, tolerates corruption and reports write failure once", () => {
  const { create } = require("../src/platform/storage.js"),
    values = new Map(),
    storage = create(() => ({
      getItem: (k) => values.get(k),
      setItem: (k, v) => values.set(k, v),
    }));
  assert.ok(storage.write("emberfall.v1", { version: 1 }));
  assert.deepEqual(storage.read("emberfall.v1"), { version: 1 });
  values.set("bad", "{");
  assert.equal(storage.read("bad", false), false);
  let warnings = 0;
  const unavailable = create(
    () => {
      throw Error("blocked");
    },
    () => warnings++,
  );
  assert.equal(unavailable.write("x", 1), false);
  assert.equal(unavailable.write("x", 2), false);
  assert.equal(warnings, 1);
});
test("invalid current modifier metadata is rejected", () => {
  const s = structuredClone(initial);
  s.p.board[0].modifiers = [
    { attack: 2, health: 0, source: "x", duration: "unknown" },
  ];
  assert.equal(new Game().restore(s), false);
});
test("hero and boss parameter changes update descriptions and execution", () => {
  const world = structuredClone(campaign);
  world.heroes[0].powerCost = 3;
  world.heroes[0].powerEffects[0].amount = 2;
  const g = setup(D.create(definitions, world));
  assert.match(g.data.heroes[0].powerText, /3 法力.*2 点伤害/);
  const hp = g.s.e.hp;
  assert.ok(
    g.dispatch({ type: "power", side: "p", target: { side: "e", uid: "hero" } })
      .ok,
  );
  assert.equal(g.s.e.hp, hp - 2);
  assert.equal(g.s.p.mana, 7);
});

test("weapon attack preview accounts for lifesteal after retaliation", () => {
  const g = setup();
  g.s.p.hp = 2;
  g.s.e.board = [];
  const enemy = g.summon("e", "treant");
  const c = card(g, "sunblade");
  g.dispatch({ type: "play", side: "p", uid: c.uid });
  const target = { side: "e", uid: enemy.uid };
  const preview = g.preview({ type: "attack", uid: "hero" }, target);
  assert.equal(preview.self.hp, 3);
  assert.equal(preview.self.dead, false);
  g.dispatch({ type: "attack", side: "p", uid: "hero", target });
  assert.equal(g.s.p.hp, preview.self.hp);
});

test("obsolete versions and incomplete modifier state are rejected without replacing the current match", () => {
  const g = setup(),
    before = g.snapshot();
  for (const mutate of [
    (s) => (s.version = 1),
    (s) => (s.ruleset = 1),
    (s) => (s.legacyDeck = true),
    (s) => delete s.p.board[0].modifiers,
    (s) => (s.p.board[0].tempAtk = 3),
    (s) =>
      s.p.board[0].modifiers.push({
        attack: 1,
        health: 1,
        duration: "turn",
        source: "bad",
      }),
  ]) {
    const s = structuredClone(before);
    mutate(s);
    assert.equal(g.restore(s), false);
    assert.deepEqual(g.snapshot(), before);
  }
});
test("serialized temporary attack has a single source and expires exactly once after restore", () => {
  const g = setup(),
    m = g.s.p.board[0];
  g.buff(m, 2, 2, { source: "permanent" });
  g.buff(m, 3, 0, { source: "turn-a", duration: "turn" });
  g.buff(m, 1, 0, { source: "turn-b", duration: "turn" });
  const saved = g.snapshot();
  assert.equal(saved.version, 3);
  assert.equal("ruleset" in saved, false);
  assert.equal("tempAtk" in saved.p.board[0], false);
  const h = new Game();
  assert.ok(h.restore(saved));
  h.endTurn("p");
  assert.equal(h.s.p.board[0].atk, 4);
  assert.equal(h.s.p.board[0].maxHp, 5);
  assert.deepEqual(
    h.s.p.board[0].modifiers.map((x) => x.source),
    ["permanent"],
  );
});
