// The battlefield's view (docs/design/BATTLE_VIEW.md): one camera and one formation for the scene, the figures and the
// tokens. A full board of both sides and both heroes is framed inside the room the page leaves, nobody stands on
// anybody, the heroes stand behind their sides, and the view stands down where there are no figures to stand.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");

const FILE = path.join(__dirname, "../src/presentation/battle-view.js");
const SCREENS = {
  desk: { mobile: false, portrait: false, width: 1600, height: 940, layout: {} },
  land: { mobile: true, portrait: false, width: 844, height: 390, layout: { arena: { x: 184, y: 48, w: 564, h: 281 } } },
  port: { mobile: true, portrait: true, width: 390, height: 844, layout: { arena: { x: 12, y: 68, w: 366, h: 548 }, mana: { x: 88, y: 700, w: 214, h: 14 } } },
};
function load(screen, search = "") {
  global.location = { search };
  global.EmberViewport = { ...SCREENS[screen], resize() {} };
  delete require.cache[require.resolve(FILE)];
  return require(FILE);
}
const inside = (p, R, pad = 1) => p.x >= R.left - pad && p.x <= R.right + pad && p.y >= R.top - pad && p.y <= R.bottom + pad;

test("a screen on its side is seen over our shoulder, a phone held upright from the front", () => {
  assert.equal(load("desk").view().mode, "side");
  assert.equal(load("land").view().mode, "side");
  assert.equal(load("port").view().mode, "front");
  assert.equal(load("land", "?view=lateral").view().mode, "lateral");
});

for (const screen of Object.keys(SCREENS))
  test(`${screen}: a full board and both heroes are framed in the room, nobody standing on anybody`, () => {
    const BV = load(screen), v = BV.view(), R = v.room;
    const feet = [];
    for (const side of ["p", "e"])
      for (let i = 0; i < 7; i++) {
        const p = BV.slot(side, i, 7);
        assert.ok(p.every(Number.isFinite), `${side}${i} has a place`);
        for (const y of [0, 1.05]) assert.ok(inside(BV.project([p[0], y, p[2]]), R), `${side}${i} (y ${y}) is on screen in the room`);
        feet.push({ side, p });
      }
    // two units are never closer on the ground than three-quarters of a person
    for (let a = 0; a < feet.length; a++)
      for (let b = a + 1; b < feet.length; b++)
        assert.ok(Math.hypot(feet[a].p[0] - feet[b].p[0], feet[a].p[2] - feet[b].p[2]) > 0.75, "units stand apart");
    // the sides face each other across the middle line, the heroes behind their own
    for (let i = 0; i < 7; i++) {
      assert.ok(BV.slot("p", i, 7)[2] > 0.5 && BV.slot("e", i, 7)[2] < -0.5);
    }
    assert.ok(BV.hero("p")[2] > Math.max(...Array.from({ length: 7 }, (_, i) => BV.slot("p", i, 7)[2])));
    assert.ok(BV.hero("e")[2] < Math.min(...Array.from({ length: 7 }, (_, i) => BV.slot("e", i, 7)[2])));
    // the camera is the same whatever is on the board
    const before = JSON.stringify(v.eye);
    BV.minionBox("p", 0, 1);
    assert.equal(JSON.stringify(BV.view().eye), before);
  });

test("a token's box stands its unit at FOOT of its height, nearer tokens over farther ones", () => {
  const BV = load("desk");
  const near = BV.minionBox("p", 0, 2), far = BV.minionBox("e", 0, 2);
  for (const b of [near, far]) {
    assert.ok(Math.abs(b.y + BV.FOOT * b.h - b.foot.y) <= 1);
    assert.ok(Math.abs(b.x + b.w / 2 - b.foot.x) <= 1);
  }
  assert.ok(near.z > far.z, "our near unit's token lies over the enemy's");
  assert.ok(near.w > far.w, "nearer is larger");
});

test("the enemy's station seen from the front keeps its plate beside the figure", () => {
  const port = load("port");
  assert.equal(port.heroBox("e").aside, true);
  assert.equal(port.heroBox("e").h, port.heroBox("e").inner);
  assert.equal(port.heroBox("p").aside, false);
  assert.ok(port.heroBox("p").h > port.heroBox("p").inner);
  assert.equal(load("desk").heroBox("e").aside, false);
});

test("our hero held upright stands clear of the mana row, its plate included", () => {
  const BV = load("port"), b = BV.heroBox("p");
  assert.ok(b.y + b.h <= SCREENS.port.layout.mana.y, `station ends at ${b.y + b.h}, the mana row starts at ${SCREENS.port.layout.mana.y}`);
});

test("the view stands down without figures and with ?view=classic", () => {
  assert.equal(load("desk").active, true);
  assert.equal(load("desk", "?view=classic").active, false);
  assert.equal(load("desk", "?figures=0").active, false);
  global.EmberMiniatures = { figures: () => false };
  try {
    assert.equal(load("desk").active, false);
  } finally {
    delete global.EmberMiniatures;
  }
});

test("a ground point under a screen point comes back to where it was projected from", () => {
  const BV = load("desk");
  for (const p of [[0, 0, 1.2], [-1.5, 0, -2], [2, 0, 0.5]]) {
    const s = BV.project(p), g = BV.ground(s.x, s.y);
    assert.ok(Math.hypot(g[0] - p[0], g[2] - p[2]) < 1e-6);
  }
});
