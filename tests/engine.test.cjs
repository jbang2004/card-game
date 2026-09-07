const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/data.js");
const { Game } = require("../src/engine.js");
function game(hero = "mage", boss = 0, relics = []) {
  const g = new Game();
  g.start(hero, boss, relics, null, 7184);
  g.mulligan();
  g.s.p.board = [];
  g.s.e.board = [];
  g.s.p.mana = g.s.p.maxMana = 10;
  g.s.e.mana = g.s.e.maxMana = 10;
  g.s.p.hand = [];
  g.s.e.hand = [];
  return g;
}
function hand(g, id, side = "p") {
  const c = g.card(id);
  g.s[side].hand.push(c);
  return c.uid;
}
function min(g, id, side = "p", extra = {}) {
  return g.summon(side, id, { sick: false, ...extra });
}
const target = (m, side = "e") => ({ side, uid: m?.uid || "hero" });

test("48 collectible cards, 8 tokens; all three 30-card decks valid", () => {
  assert.equal(D.cards.filter((c) => !c.token).length, 48);
  assert.equal(D.cards.length, 56);
  const g = new Game();
  for (const h of D.heroes) {
    assert.equal(h.deck.length, 30);
    assert.ok(g.validateDeck(h.deck));
  }
  assert.ok(!g.validateDeck(Array(30).fill("spark")));
  assert.ok(!g.validateDeck([...D.heroes[0].deck.slice(0, 29), "skeleton"]));
});
test("mulligan, initial draw and opponent coin", () => {
  const g = new Game();
  g.start("mage", 0, [], null, 123);
  assert.equal(g.s.p.hand.length, 3);
  assert.equal(g.s.e.hand.length, 5);
  const old = g.s.p.hand[0].uid;
  g.mulligan([old]);
  assert.equal(g.s.p.hand.length, 4);
  assert.equal(g.s.p.deck.length, 26);
  assert.equal(g.s.p.mana, 1);
  assert.equal(
    new Set([...g.s.p.hand, ...g.s.p.deck].map((c) => c.uid)).size,
    30,
  );
});
test("mana refresh and cap", () => {
  const g = game();
  g.s.p.maxMana = 8;
  g.s.p.mana = 0;
  g.endTurn("p");
  g.endTurn("e");
  assert.equal(g.s.p.mana, 9);
  g.endTurn("p");
  g.endTurn("e");
  assert.equal(g.s.p.mana, 10);
  g.endTurn("p");
  g.endTurn("e");
  assert.equal(g.s.p.mana, 10);
});
test("invalid target and insufficient mana are atomic rejections", () => {
  const g = game();
  const id = hand(g, "fireball");
  const before = JSON.stringify(g.s);
  assert.equal(g.play("p", id, target(null, "p")).ok, false);
  assert.equal(JSON.stringify(g.s), before);
  g.s.p.mana = 1;
  assert.equal(g.play("p", id, target(null)).ok, false);
  assert.equal(g.s.p.hand.length, 1);
});
test("summon sickness prevents attacking", () => {
  const g = game();
  const id = hand(g, "guard");
  g.play("p", id);
  const m = g.s.p.board[0];
  assert.equal(g.canAttack("p", m.uid), false);
  g.endTurn("p");
  g.endTurn("e");
  assert.ok(g.canAttack("p", m.uid));
});
test("rush permits minion combat, never same-turn face attacks", () => {
  const g = game();
  const m = g.summon("p", "sentinel");
  min(g, "spark", "e");
  assert.equal(g.attackTargets("p", m.uid).length, 1);
  assert.equal(g.attackTargets("p", m.uid)[0].uid, g.s.e.board[0].uid);
  assert.equal(g.attack("p", m.uid, target(null)).ok, false);
});
test("charge can attack heroes immediately", () => {
  const g = game();
  const m = g.summon("p", "huntress");
  assert.ok(g.attack("p", m.uid, target(null)).ok);
  assert.equal(g.s.e.hp, 25);
});
test("taunt must be attacked; hidden taunt does not restrict targets", () => {
  const g = game();
  const m = min(g, "guard");
  const enemy = min(g, "treant", "e");
  min(g, "wolf", "e");
  assert.deepEqual(g.attackTargets("p", m.uid), [target(enemy)]);
  enemy.tags.push("stealth");
  assert.ok(g.attackTargets("p", m.uid).some((t) => t.uid === "hero"));
});
test("divine shield blocks poison and damage, then disappears", () => {
  const g = game();
  const m = min(g, "spider");
  const enemy = min(g, "squire", "e");
  g.attack("p", m.uid, target(enemy));
  assert.ok(g.s.e.board.some((x) => x.uid === enemy.uid));
  assert.equal(enemy.hp, 2);
  assert.ok(!enemy.tags.includes("shield"));
  m.attacks = 0;
  g.attack("p", m.uid, target(enemy));
  assert.equal(g.s.e.board.length, 0);
});
test("combat damage is simultaneous", () => {
  const g = game();
  const a = min(g, "guard");
  const b = min(g, "guard", "e");
  a.atk = b.atk = 3;
  g.attack("p", a.uid, target(b));
  assert.equal(g.s.p.board.length, 0);
  assert.equal(g.s.e.board.length, 0);
});
test("windfury allows exactly two attacks", () => {
  const g = game();
  const m = min(g, "berserker");
  assert.ok(g.attack("p", m.uid, target(null)).ok);
  assert.ok(g.attack("p", m.uid, target(null)).ok);
  assert.equal(g.attack("p", m.uid, target(null)).ok, false);
  assert.equal(g.s.e.hp, 24);
});
test("stealth blocks enemy targeting, not friendly buffs or AoE", () => {
  const g = game();
  const m = min(g, "assassin", "e");
  assert.equal(g.targets("enemyMinion", "p").length, 0);
  g.play("p", hand(g, "storm"));
  assert.equal(g.s.e.board.length, 0);
});
test("lifesteal heals for damage dealt and shields block it", () => {
  const g = game();
  g.s.p.hp = 20;
  const m = min(g, "leech");
  g.attack("p", m.uid, target(null));
  assert.equal(g.s.p.hp, 23);
  m.attacks = 0;
  const enemy = min(g, "squire", "e");
  g.attack("p", m.uid, target(enemy));
  assert.equal(g.s.p.hp, 23);
});
test("deathrattles trigger after dead minions free board slots", () => {
  const g = game();
  for (let i = 0; i < 7; i++) min(g, "wolf");
  g.s.p.board.forEach((m) => (m.hp = 0));
  g.cleanup();
  assert.equal(g.s.p.board.length, 7);
  assert.ok(g.s.p.board.every((m) => m.cid === "pup"));
});
test("reborn fires once, at 1 health, with fresh summon sickness", () => {
  const g = game();
  const m = min(g, "phoenix");
  m.hp = 0;
  g.cleanup();
  const reborn = g.s.p.board[0];
  assert.equal(reborn.hp, 1);
  assert.ok(reborn.sick);
  assert.ok(!reborn.tags.includes("reborn"));
  reborn.hp = 0;
  g.cleanup();
  assert.equal(g.s.p.board.length, 0);
});
test("spell damage stacks with relic, but not hero powers", () => {
  const g = game("mage", 0, ["lens"]);
  min(g, "wisp");
  g.play("p", hand(g, "bolt"), target(null));
  assert.equal(g.s.e.hp, 26);
  g.power("p", target(null));
  assert.equal(g.s.e.hp, 25);
});
test("freeze blocks next own turn and thaws at own end", () => {
  const g = game();
  const m = min(g, "guard", "e");
  g.play("p", hand(g, "frostbolt"), target(m));
  /* guard dies: use larger */ const n = min(g, "treant", "e");
  g.s.p.mana = 10;
  g.play("p", hand(g, "frostbolt"), target(n));
  g.endTurn("p");
  assert.ok(n.frozen);
  assert.equal(g.canAttack("e", n.uid), false);
  g.endTurn("e");
  assert.equal(n.frozen, false);
});
test("silence removes enchantments, taunt and deathrattle", () => {
  const g = game();
  const m = min(g, "golem", "e");
  g.buff(m, 3, 3);
  g.play("p", hand(g, "silence"), target(m));
  assert.equal(m.atk, 2);
  assert.equal(m.maxHp, 5);
  assert.deepEqual(m.tags, []);
  m.hp = 0;
  g.cleanup();
  assert.equal(g.s.e.armor, 0);
});
test("polymorph resets stats and keywords without a deathrattle", () => {
  const g = game();
  const m = min(g, "golem", "e");
  g.play("p", hand(g, "polymorph"), target(m));
  const sheep = g.s.e.board[0];
  assert.equal(sheep.cid, "sheep");
  assert.equal(sheep.hp, 1);
  assert.deepEqual(sheep.tags, []);
  assert.equal(g.s.e.armor, 0);
});
test("temporary attack expires at own turn end", () => {
  const g = game();
  const m = min(g, "guard");
  g.play("p", hand(g, "battlecry"), target(m, "p"));
  assert.equal(m.atk, 4);
  g.endTurn("p");
  assert.equal(m.atk, 2);
});
test("weapon enables hero attack and loses durability", () => {
  const g = game();
  g.play("p", hand(g, "dagger"));
  g.attack("p", "hero", target(null));
  assert.equal(g.s.e.hp, 28);
  assert.equal(g.s.p.weapon.durability, 1);
  assert.equal(g.attack("p", "hero", target(null)).ok, false);
  g.endTurn("p");
  g.endTurn("e");
  g.attack("p", "hero", target(null));
  assert.equal(g.s.p.weapon, null);
});
test("minions retaliate against attacking heroes", () => {
  const g = game();
  const m = min(g, "treant", "e");
  g.play("p", hand(g, "dagger"));
  g.attack("p", "hero", target(m));
  assert.equal(g.s.p.hp, 27);
  assert.equal(m.hp, 4);
});
test("secret redirects incoming face attack to summoned guard", () => {
  const g = game();
  g.s.p.secrets = ["ambush"];
  const m = min(g, "guard", "e");
  g.s.active = "e";
  g.attack("e", m.uid, target(null, "p"));
  assert.equal(g.s.p.hp, 30);
  assert.equal(g.s.p.secrets.length, 0);
  assert.equal(g.s.p.board[0].hp, 1);
  assert.equal(m.hp, 1);
});
test("duplicate secrets are rejected before spending mana", () => {
  const g = game();
  g.s.p.secrets = ["ambush"];
  const uid = hand(g, "ambush"),
    before = g.s.p.mana;
  assert.equal(g.play("p", uid).ok, false);
  assert.equal(g.s.p.mana, before);
});
test("discover requires choice and grants exactly one card", () => {
  const g = game();
  g.play("p", hand(g, "discovery"));
  assert.equal(g.s.choice.cards.length, 3);
  assert.equal(g.endTurn("p").ok, false);
  assert.equal(g.choose("skeleton").ok, false);
  const id = g.s.choice.cards[1];
  g.choose(id);
  assert.equal(g.s.p.hand[0].cid, id);
  assert.equal(g.s.choice, null);
});
test("hand cap burns; empty deck causes escalating fatigue", () => {
  const g = game();
  for (let i = 0; i < 10; i++) hand(g, "spark");
  const n = g.s.p.deck.length;
  g.draw("p");
  assert.equal(g.s.p.hand.length, 10);
  assert.equal(g.s.p.deck.length, n - 1);
  g.s.p.deck = [];
  g.draw("p", 3);
  assert.equal(g.s.p.hp, 24);
  assert.equal(g.s.p.fatigue, 3);
});
test("board cap prevents spending a minion card", () => {
  const g = game();
  for (let i = 0; i < 7; i++) min(g, "spark");
  const id = hand(g, "guard");
  assert.equal(g.play("p", id).ok, false);
  assert.equal(g.s.p.mana, 10);
  assert.equal(g.s.p.hand.length, 1);
});
test("each boss transitions exactly once at half health", () => {
  for (let i = 0; i < 5; i++) {
    const g = game("mage", i);
    g.s.e.hp = Math.floor(g.s.e.maxHp / 2);
    g.cleanup();
    assert.ok(g.s.phase2);
    const n = g.s.e.board.length,
      a = g.s.e.armor;
    g.cleanup();
    assert.equal(g.s.e.board.length, n);
    assert.equal(g.s.e.armor, a);
  }
});
test("boss lethal does not trigger phase 2; over-state is immutable to actions", () => {
  const g = game();
  g.s.e.hp = 1;
  g.play("p", hand(g, "bolt"), target(null));
  assert.equal(g.s.phase, "over");
  assert.equal(g.s.winner, "p");
  assert.equal(g.s.phase2, false);
  const before = JSON.stringify(g.s);
  assert.equal(g.endTurn("p").ok, false);
  assert.equal(g.power("p", target(null)).ok, false);
  assert.equal(JSON.stringify(g.s), before);
});
test("simultaneous lethal is a draw", () => {
  const g = game();
  g.s.p.hp = g.s.e.hp = 3;
  g.play("p", hand(g, "ashdragon"));
  assert.equal(g.s.winner, "draw");
});
test("relics apply starting health, armor, mana and summon", () => {
  const g = new Game();
  g.start("mage", 0, ["heart", "crown", "ember", "banner"], null, 5);
  assert.equal(g.s.p.maxHp, 38);
  assert.equal(g.s.p.armor, 7);
  assert.equal(g.s.p.maxMana, 1);
  assert.equal(g.s.p.board[0].cid, "squire");
  g.mulligan();
  assert.equal(g.s.p.mana, 2);
});
test("serialized restoration retains deterministic RNG and action state", () => {
  const g = game();
  g.s.p.hand = [g.card("discovery")];
  const h = new Game();
  assert.ok(h.restore(JSON.parse(JSON.stringify(g.s))));
  g.play("p", g.s.p.hand[0].uid);
  h.play("p", h.s.p.hand[0].uid);
  assert.deepEqual(h.s, g.s);
});
test("AI does not read the hidden contents of the player hand or deck", () => {
  const g = game();
  g.s.active = "e";
  hand(g, "guard", "e");
  const a = g.aiAction();
  g.s.p.hand = Array.from({ length: 10 }, () => g.card("ashdragon"));
  g.s.p.deck = Array.from({ length: 20 }, () => g.card("bolt"));
  assert.deepEqual(g.aiAction(), a);
});
test("AI actions are legal across all bosses", () => {
  for (let boss = 0; boss < 5; boss++) {
    const g = game("mage", boss);
    g.s.active = "e";
    g.s.e.hand = D.bosses[boss].deck.slice(0, 8).map((id) => g.card(id));
    for (let i = 0; i < 35 && g.s.active === "e" && g.s.phase === "battle"; i++)
      assert.ok(g.aiStep().ok);
    assert.ok(g.s.active === "p" || g.s.phase === "over");
  }
});

test("150 randomized complete games maintain state invariants", () => {
  let finished = 0;
  for (let trial = 0; trial < 150; trial++) {
    const g = new Game();
    g.start(D.heroes[trial % 3].id, trial % 5, [], null, trial + 10);
    g.mulligan();
    for (let step = 0; step < 1200 && g.s.phase === "battle"; step++) {
      if (g.s.active === "e") {
        const r = g.aiStep();
        assert.ok(r.ok, r.error);
      } else if (g.s.choice) {
        g.choose(g.s.choice.cards[0]);
      } else {
        const actions = [];
        for (const c of g.s.p.hand) {
          if (g.legalCard("p", c.uid)) continue;
          const d = D.byId[c.cid],
            ts = d.target ? g.targets(d.target, "p") : [null];
          if (!ts.length && d.type === "minion") ts.push(null);
          for (const t of ts) actions.push(() => g.play("p", c.uid, t));
        }
        for (const m of [...g.s.p.board, { uid: "hero" }])
          for (const t of g.attackTargets("p", m.uid))
            actions.push(() => g.attack("p", m.uid, t));
        if (
          !g.s.p.powerUsed &&
          g.s.p.mana >= 2 &&
          (g.s.heroId !== "paladin" || g.s.p.board.length < 7)
        ) {
          const ts = g.s.heroId === "mage" ? g.targets("enemy", "p") : [null];
          for (const t of ts) actions.push(() => g.power("p", t));
        }
        const fn = actions.length
          ? actions[Math.floor(g.rand() * actions.length)]
          : () => g.endTurn("p");
        const r = fn();
        assert.ok(r.ok, r.error);
      }
      for (const side of ["p", "e"]) {
        const p = g.s[side];
        assert.ok(p.mana >= 0 && p.mana <= 10);
        assert.ok(p.maxMana >= 0 && p.maxMana <= 10);
        assert.ok(p.board.length <= 7);
        assert.ok(p.hand.length <= 10);
        assert.ok(p.hp <= p.maxHp);
        assert.ok(
          p.board.every((m) => m.hp > 0 && m.hp <= m.maxHp && m.atk >= 0),
        );
        const ids = [...p.board, ...p.hand, ...p.deck].map((m) => m.uid);
        assert.equal(new Set(ids).size, ids.length);
      }
    }
    assert.equal(g.s.phase, "over", "random game failed to terminate");
    finished++;
  }
  assert.equal(finished, 150);
});
