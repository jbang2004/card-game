const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../src/data.js");
const P = require("../src/presentation/fx-profiles.js");
const { Game } = require("../src/engine.js");
const { compile } = require("../src/presentation/combat.js");
const T = require("../src/presentation/timing.js");

test("every playable card and token has an explicit immutable combat profile", () => {
  assert.deepEqual(
    Object.keys(P.records).sort(),
    D.cards.map((c) => c.id).sort(),
  );
  for (const card of D.cards) {
    const p = P.get(card);
    assert.ok(Object.isFrozen(p));
    assert.ok(p.windup >= 300 && p.windup <= 800);
    assert.ok(p.attack);
    assert.ok(p.cast);
  }
  assert.throws(
    () => P.get("unregistered-card"),
    /Missing combat presentation/,
  );
  assert.equal(
    new Set(
      ["solaris", "nyx", "ashdragon", "frostking"].map(
        (id) => P.get(id).arrival,
      ),
    ).size,
    4,
  );
  assert.equal(
    new Set(
      ["guard", "wolf", "titan", "archer", "huntress", "nyx", "dragon"].map(
        (id) => P.get(id).attack,
      ),
    ).size,
    7,
  );
});
test("major spell travel and all affected health changes meet at one beat without touching rules", () => {
  const g = new Game();
  g.demo();
  g.s.e.board = [];
  for (let i = 0; i < 3; i++) g.summon("e", "treant");
  g.s.p.mana = 10;
  g.s.p.hand = [g.card("storm")];
  g.events = [];
  const before = g.snapshot();
  const result = g.dispatch({
    type: "play",
    side: "p",
    uid: g.s.p.hand[0].uid,
  });
  assert.ok(result.ok);
  const final = g.snapshot();
  const saved = JSON.stringify(final);
  const plan = compile(result.events, before, final);
  const cast = plan.beats.find((b) => b.kind === "play"),
    hit = plan.beats.find((b) => b.kind === "hit");
  // V2 §4.2: cast flash, then the first AOE contact immediately.
  assert.equal(hit.at - cast.at, T.spell.castFlash);
  assert.equal(cast.cast.startAt, cast.at);
  // 45ms steps, the later two shifted by the single impulse's hit-stop.
  assert.deepEqual(hit.contacts.map((c) => c.contactAt - hit.at), [0, 95, 140]);
  assert.equal(hit.events.length, 3);
  assert.equal(JSON.stringify(final), saved);
  assert.ok(plan.duration <= 6500);
  const reduced = compile(result.events, before, final, true);
  const full = compile(result.events, before, final);
  // Reduced motion: half-length and no hit-stop, so never later than 50%.
  assert.ok(reduced.beats.every((b, i) => b.at <= full.beats[i].at * 0.5 + 1e-9));
  assert.ok(reduced.duration > 0 && reduced.duration <= full.duration * 0.5 + 1e-9);
  assert.equal(JSON.stringify(final), saved);
});
