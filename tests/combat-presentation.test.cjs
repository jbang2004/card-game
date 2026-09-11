const test = require("node:test"),
  assert = require("node:assert/strict");
const { Game } = require("../src/engine.js");
const { compile } = require("../src/presentation/combat.js");
const EmberFXProfiles = require("../src/presentation/fx-profiles.js");
function setup() {
  const g = new Game();
  g.demo();
  g.s.p.board = [];
  g.s.e.board = [];
  g.s.p.hp = 15;
  g.s.p.mana = g.s.p.maxMana = 10;
  g.s.e.hp = g.s.e.maxHp;
  g.events = [];
  return g;
}
function play(g, id, target) {
  const c = g.card(id);
  g.s.p.hand = [c];
  g.events = [];
  const before = g.snapshot(),
    result = g.dispatch({ type: "play", side: "p", uid: c.uid, target });
  assert.ok(result.ok, result.error);
  return { result, before, plan: compile(result.events, before, g.snapshot()) };
}
test("damage, death and deathrattle summons are separate observations, without changing final rules", () => {
  const g = setup(),
    wolf = g.summon("e", "wolf");
  const { plan, result } = play(g, "fireball", { side: "e", uid: wolf.uid });
  const hit = plan.beats.find((x) => x.kind === "hit"),
    death = plan.beats.find((x) => x.kind === "death"),
    summon = plan.beats.find((x) => x.kind === "summon");
  assert.ok(hit.at < death.at && death.at < summon.at);
  assert.ok(hit.frame.e.board.some((m) => m.uid === wolf.uid));
  assert.ok(!death.frame.e.board.some((m) => m.uid === wolf.uid));
  assert.ok(!death.frame.e.board.some((m) => m.cid === "pup"));
  assert.ok(summon.frame.e.board.some((m) => m.cid === "pup"));
  assert.equal(summon.sourceId, wolf.uid);
  assert.ok(Object.isFrozen(result.events[0]));
});
test("AOE hits share a timestamp and individual draws have distinct identities and landing beats", () => {
  const g = setup();
  g.summon("e", "guard");
  g.summon("e", "guard");
  let p = play(g, "storm").plan;
  assert.equal(p.beats.filter((b) => b.kind === "hit").length, 1);
  assert.equal(p.beats.find((b) => b.kind === "hit").events.length, 2);
  p = play(g, "wisdom").plan;
  const draws = p.beats.filter((b) => b.kind === "draw");
  assert.ok(draws.length >= 2);
  assert.ok(draws[0].at < draws[1].at);
  assert.notEqual(draws[0].events[0].uid, draws[1].events[0].uid);
  assert.equal(draws[1].frame.p.hand.length, draws[0].frame.p.hand.length + 1);
});
test("lifesteal identifies damaged minion, armor absorption and retaliation sources precisely", () => {
  const g = setup(),
    m = g.summon("e", "treant");
  const { result } = play(g, "lifedrain", { side: "e", uid: m.uid });
  assert.deepEqual(result.events.find((e) => e.type === "heal").from, {
    side: "e",
    uid: m.uid,
  });
  g.s.p.board = [];
  const a = g.summon("p", "leech", { sick: false });
  g.s.e.board = [];
  g.s.e.armor = 2;
  g.events = [];
  const attack = g.dispatch({
    type: "attack",
    side: "p",
    uid: a.uid,
    target: { side: "e", uid: "hero" },
  });
  const damage = attack.events.find((e) => e.type === "damage");
  assert.equal(damage.absorbed, 2);
  assert.deepEqual(damage.from, { side: "p", uid: a.uid });
  assert.deepEqual(attack.events.find((e) => e.type === "heal").from, {
    side: "e",
    uid: "hero",
  });
});
test("secret is revealed before interceptor and attack; reborn carries its dead source", () => {
  const g = setup(),
    a = g.summon("p", "guard", { sick: false });
  g.s.e.secrets = ["ambush"];
  g.events = [];
  const before = g.snapshot(),
    result = g.dispatch({
      type: "attack",
      side: "p",
      uid: a.uid,
      target: { side: "e", uid: "hero" },
    });
  const plan = compile(result.events, before, g.snapshot());
  assert.deepEqual(
    plan.beats.slice(0, 3).map((b) => b.kind),
    ["secret", "summon", "attack"],
  );
  const h = setup(),
    bird = h.summon("e", "phoenix", { hp: 1 });
  const r = play(h, "bolt", { side: "e", uid: bird.uid }).result;
  const reborn = r.events.find((e) => e.type === "summon" && e.rebornFrom);
  assert.equal(reborn.rebornFrom, bird.uid);
});
test("status transitions include freeze/thaw, buff/expiry, silence and transform", () => {
  const g = setup(),
    m = g.summon("e", "treant");
  assert.ok(
    play(g, "frostbolt", { side: "e", uid: m.uid }).result.events.some(
      (e) => e.kind === "freeze",
    ),
  );
  g.s.active = "e";
  g.events = [];
  assert.ok(
    g
      .dispatch({ type: "end", side: "e" })
      .events.some((e) => e.kind === "thaw"),
  );
  const friend = g.summon("p", "guard");
  assert.ok(
    play(g, "battlecry", { side: "p", uid: friend.uid }).result.events.some(
      (e) => e.kind === "buff",
    ),
  );
  g.events = [];
  assert.ok(
    g
      .dispatch({ type: "end", side: "p" })
      .events.some((e) => e.kind === "expire"),
  );
  g.s.active = "p";
  g.s.p.mana = 10;
  assert.ok(
    play(g, "silence", { side: "p", uid: friend.uid }).result.events.some(
      (e) => e.kind === "silence",
    ),
  );
  assert.ok(
    play(g, "polymorph", { side: "e", uid: m.uid }).result.events.some(
      (e) => e.kind === "transform",
    ),
  );
});
test("event views expose no deck identities or enemy hand identities, and compilation cannot mutate inputs", () => {
  const g = setup(),
    r = play(g, "wisdom"),
    original = JSON.stringify(r.result.events),
    state = JSON.stringify(g.s);
  for (const e of r.result.events)
    if (e.view) {
      assert.ok(e.view.e.hand.every((c) => Object.keys(c).join() === "uid"));
      assert.ok([...e.view.p.deck, ...e.view.e.deck].every((c) => c === null));
      assert.equal(e.view.rng, undefined);
    }
  const reduced = compile(r.result.events, r.before, g.snapshot(), true);
  assert.equal(reduced.duration, 0);
  assert.equal(JSON.stringify(r.result.events), original);
  assert.equal(JSON.stringify(g.s), state);
});

test("simultaneous deaths depart together before either deathrattle, with no returning corpses", () => {
  const g = setup();
  const a = g.summon("e", "wolf"),
    b = g.summon("e", "wolf");
  const { plan } = play(g, "storm");
  const deaths = plan.beats.filter((b) => b.kind === "death");
  assert.equal(deaths.length, 1);
  assert.deepEqual(
    deaths[0].events.map((e) => e.uid),
    [a.uid, b.uid],
  );
  const summons = plan.beats.filter((b) => b.kind === "summon");
  assert.equal(summons.length, 2);
  assert.ok(summons.every((b) => b.at > deaths[0].at));
  assert.equal(deaths[0].frame.e.board.length, 0);
});

test("attack beats expose one causal contact marker and a single scaled motion descriptor", () => {
  const g = setup(),
    attacker = g.summon("p", "guard", { sick: false }),
    target = g.summon("e", "treant", { sick: false });
  g.events = [];
  const before = g.snapshot(),
    result = g.dispatch({
      type: "attack",
      side: "p",
      uid: attacker.uid,
      target: { side: "e", uid: target.uid },
    }),
    plan = compile(result.events, before, g.snapshot(), false, "blade"),
    attack = plan.beats.find((beat) => beat.kind === "attack"),
    hit = plan.beats.find((beat) => beat.kind === "hit");
  assert.ok(attack?.motion);
  assert.equal(attack.markers.contact, hit.at);
  assert.equal(
    attack.markers.end,
    attack.markers.start + attack.motion.duration,
  );
  assert.equal(
    attack.motion.duration,
    attack.motion.recoveryEnd,
  );
  assert.equal(
    attack.markers.recoveryEnd,
    attack.markers.start + attack.motion.recoveryEnd,
  );
  assert.ok(plan.duration <= 6500);
  assert.ok(Object.isFrozen(attack.motion));
  assert.equal(EmberFXProfiles.motionFor("slam", 220, true).heavy, true);
  const reduced = compile(result.events, before, g.snapshot(), true, "blade");
  assert.equal(reduced.duration, 0);
  assert.ok(reduced.beats.every((beat) => beat.markers.end === 0));
});

test("attack contact association is causal, exact and excludes nested or later hits", () => {
  const a = { side: "p", uid: "attacker" },
    b = { side: "e", uid: "target" },
    events = [
      { id: "action-1", type: "blockStart", parentId: null, kind: "action" },
      { id: "attack-1", type: "attack", parentId: "action-1", from: a, to: b },
      {
        id: "trigger-1",
        type: "blockStart",
        parentId: "action-1",
        kind: "trigger",
      },
      {
        id: "nested-hit",
        type: "damage",
        parentId: "trigger-1",
        from: a,
        side: b.side,
        uid: b.uid,
        amount: 9,
        loss: 9,
      },
      {
        id: "trigger-end",
        type: "blockEnd",
        parentId: "action-1",
        blockId: "trigger-1",
      },
      {
        id: "direct-hit",
        type: "damage",
        parentId: "action-1",
        from: a,
        side: b.side,
        uid: b.uid,
        amount: 2,
        loss: 2,
      },
      {
        id: "retaliation",
        type: "damage",
        parentId: "action-1",
        from: b,
        side: a.side,
        uid: a.uid,
        amount: 9,
        loss: 9,
      },
      {
        id: "action-1-end",
        type: "blockEnd",
        parentId: null,
        blockId: "action-1",
      },
      { id: "action-2", type: "blockStart", parentId: null, kind: "action" },
      { id: "attack-2", type: "attack", parentId: "action-2", from: a, to: b },
      {
        id: "later-hit",
        type: "damage",
        parentId: "action-2",
        from: a,
        side: b.side,
        uid: b.uid,
        amount: 6,
        loss: 6,
      },
      {
        id: "late-action-1-hit",
        type: "damage",
        parentId: "action-1",
        from: a,
        side: b.side,
        uid: b.uid,
        amount: 7,
        loss: 7,
      },
    ],
    plan = compile(events, { p: {}, e: {} }, { p: {}, e: {} }),
    firstAttack = plan.beats.find((beat) => beat.events[0]?.id === "attack-1"),
    firstHit = plan.beats.find((beat) =>
      beat.events.some((event) => event.id === "direct-hit"),
    ),
    secondAttack = plan.beats.find((beat) => beat.events[0]?.id === "attack-2");
  assert.equal(firstAttack.contacts.length, 1);
  assert.equal(firstAttack.contacts[0].eventId, "direct-hit");
  assert.deepEqual(firstAttack.contacts[0].targetRef, b);
  assert.equal(firstAttack.contacts[0].heavy, false);
  assert.equal(firstHit.contacts.length, 2);
  assert.deepEqual(
    firstHit.contacts.map((contact) => [contact.eventId, contact.direction]),
    [
      ["direct-hit", "outgoing"],
      ["retaliation", "retaliation"],
    ],
  );
  assert.equal(firstHit.contacts[1].heavy, true);
  assert.deepEqual(firstHit.contacts[1].targetRef, a);
  assert.ok(firstHit.contacts.every((contact) =>
    ["contactAt", "releaseAt", "recoveryEndAt"].every((key) =>
      Number.isFinite(contact[key]),
    ),
  ));
  assert.equal(
    firstHit.contacts[0].releaseAt,
    firstHit.contacts[1].releaseAt,
  );
  assert.equal(
    firstHit.contacts[0].recoveryEndAt,
    firstHit.contacts[1].recoveryEndAt,
  );
  assert.equal(secondAttack.contacts[0].eventId, "later-hit");
  assert.ok(!plan.beats.some((beat) =>
    beat.contacts?.some((contact) => contact.eventId === "nested-hit"),
  ));
  assert.ok(!plan.beats.some((beat) =>
    beat.contacts?.some((contact) => contact.eventId === "late-action-1-hit"),
  ));
});

test("attack source identity comes from the attack observation, including ranged and broken weapons", () => {
  const g = setup();
  g.s.p.weapon = {
    cid: "sunblade",
    atk: 4,
    durability: 1,
    tags: [],
  };
  const target = g.summon("e", "treant", { sick: false });
  g.events = [];
  const before = g.snapshot(),
    result = g.dispatch({
      type: "attack",
      side: "p",
      uid: "hero",
      target: { side: "e", uid: target.uid },
    }),
    plan = compile(result.events, null, g.snapshot()),
    attack = plan.beats.find((beat) => beat.kind === "attack");
  assert.equal(before.p.weapon.cid, "sunblade");
  assert.equal(g.s.p.weapon, null);
  assert.equal(attack.sourceCid, "sunblade");
  assert.equal(attack.attackFamily, "blade");

  const ranged = setup(),
    archer = ranged.summon("p", "archer", { sick: false }),
    rangedTarget = ranged.summon("e", "treant", { sick: false });
  ranged.events = [];
  const rangedResult = ranged.dispatch({
      type: "attack",
      side: "p",
      uid: archer.uid,
      target: { side: "e", uid: rangedTarget.uid },
    }),
    rangedPlan = compile(rangedResult.events, null, ranged.snapshot()),
    rangedAttack = rangedPlan.beats.find((beat) => beat.kind === "attack"),
    rangedContact = rangedPlan.beats.find((beat) => beat.kind === "hit");
  assert.equal(rangedAttack.sourceCid, "archer");
  assert.equal(rangedAttack.motion.family, "arrow");
  assert.equal(rangedAttack.motion.ranged, true);
  assert.ok(rangedContact.contacts[0].recoveryEndAt > rangedContact.at);
});

test("absorbed damage is not heavy and long timelines scale every motion marker once", () => {
  const a = { side: "p", uid: "attacker" },
    b = { side: "e", uid: "target" },
    absorbed = [
      { id: "action", type: "blockStart", parentId: null, kind: "action" },
      { id: "attack", type: "attack", parentId: "action", from: a, to: b },
      {
        id: "absorbed",
        type: "damage",
        parentId: "action",
        from: a,
        side: b.side,
        uid: b.uid,
        amount: 6,
        loss: 0,
        absorbed: 6,
      },
    ],
    absorbedPlan = compile(absorbed, { p: {}, e: {} }, { p: {}, e: {} }),
    absorbedAttack = absorbedPlan.beats.find((beat) => beat.kind === "attack");
  assert.equal(absorbedAttack.contacts[0].heavy, false);

  const longEvents = Array.from({ length: 30 }, (_, i) => ({
    id: "draw-" + i,
    type: "draw",
    parentId: null,
    side: "p",
    uid: "card-" + i,
  })).concat(absorbed);
  const longPlan = compile(longEvents, { p: {}, e: {} }, { p: {}, e: {} }),
    longAttack = longPlan.beats.find((beat) => beat.kind === "attack");
  const expectedScale = 6500 / 7720;
  assert.ok(Math.abs(longPlan.scale - expectedScale) < 1e-12);
  assert.ok(longPlan.duration <= 6500);
  assert.ok(Math.abs(longPlan.duration - 7720 * expectedScale) < 1e-9);
  assert.ok(
    Math.abs(
      longAttack.markers.contact -
        7420 * expectedScale,
    ) < 1e-9,
  );
  assert.ok(
    Math.abs(
      longAttack.markers.recoveryEnd -
        7670 * expectedScale,
    ) < 1e-9,
  );
  assert.ok(Math.abs(longAttack.markers.release - 7450 * expectedScale) < 1e-9);
  assert.ok(longAttack.markers.end <= longPlan.duration);
});
