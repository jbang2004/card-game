const test = require("node:test"),
  assert = require("node:assert/strict");
const T = require("../src/presentation/timing.js");

test("tierOf follows the §4.1 weight boundaries", () => {
  assert.equal(T.tierOf({ amount: 0 }), 1);
  assert.equal(T.tierOf({}), 1);
  assert.equal(T.tierOf(), 1);
  assert.equal(T.tierOf({ amount: 1 }), 1);
  assert.equal(T.tierOf({ amount: 2 }), 1);
  assert.equal(T.tierOf({ amount: 3 }), 2);
  assert.equal(T.tierOf({ amount: 5 }), 2);
  assert.equal(T.tierOf({ amount: 6 }), 3);
  assert.equal(T.tierOf({ amount: 12 }), 3);
  assert.equal(T.tierOf({ amount: -4 }), 1);
  assert.equal(T.tierOf({ amount: "x" }), 1);
});

test("lethal and heavy hero damage escalate to tier 3", () => {
  assert.equal(T.tierOf({ amount: 1, lethal: true }), 3);
  assert.equal(T.tierOf({ amount: 0, lethal: true }), 3);
  assert.equal(T.tierOf({ amount: 4, heroTarget: true }), 2);
  assert.equal(T.tierOf({ amount: 5, heroTarget: true }), 3);
  assert.equal(T.tierOf({ amount: 5, heroTarget: false }), 2);
  assert.equal(T.tierOf({ amount: 2, heroTarget: true }), 1);
});

test("timing table is frozen and matches the contract numbers", () => {
  assert.ok(Object.isFrozen(T) && Object.isFrozen(T.tiers) && Object.isFrozen(T.tiers[3]));
  assert.equal(T.tiers[0], null);
  assert.deepEqual(
    T.tiers.slice(1).map((t) => [t.contactScale, t.shakePx, t.shakeMs, t.hitStopMs, t.recoilPx, t.volume]),
    [
      [0.8, 0, 0, 0, 6, 0.75],
      [1.0, 3, 160, 50, 10, 0.9],
      [1.2, 6, 240, 90, 14, 1.0],
    ],
  );
  assert.equal(T.attack.lift + T.attack.lunge + T.attack.recover, 460);
  assert.equal(T.death.delay + T.death.freeze + T.death.dissolve + T.death.reflow, 760);
  assert.equal(T.cutin.in + T.cutin.hold + T.cutin.out, 340);
  assert.equal(T.cutin.lead, 340);
  assert.equal(T.stagger * T.staggerSteps + T.spell.castFlash, 345);
  assert.equal(T.summon.land + T.summon.legendary, 760);
  assert.throws(() => {
    "use strict";
    T.stagger = 1;
  });
});
