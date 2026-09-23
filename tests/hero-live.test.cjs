/* A hero without a baked live portrait silently keeps the relief face on the
 * hero-select card (`EmberHeroLive.mount` resolves false). Surface that here. */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const campaign = require("../src/content/campaign.js");
const maps = require("../src/hero-live-maps.js");
const rigs = require("../src/presentation/hero-live-rigs.js");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/presentation/hero-live.js");
const KINDS = ["bg", "body", "front", "depth", "ctrl", "flags"];

test("every selectable hero has a baked live portrait and a motion rig", () => {
  const portraits = campaign.heroes.map((h) => h.portraitId).sort();
  assert.deepEqual(Object.keys(maps).sort(), portraits, "Run tools/bake_hero_live.py.");
  assert.deepEqual(Object.keys(rigs).sort(), portraits);
  const referenced = [];
  for (const [id, set] of Object.entries(maps)) {
    assert.deepEqual(Object.keys(set), KINDS, id);
    for (const kind of KINDS) {
      assert.equal(set[kind], `asset:hero-live/${id}-${kind}.webp`);
      assert.ok(fs.statSync(path.join(root, "art/hero-live", `${id}-${kind}.webp`)).size > 1000);
      referenced.push(`${id}-${kind}.webp`);
    }
  }
  const baked = fs.readdirSync(path.join(root, "art/hero-live")).filter((f) => f.endsWith(".webp"));
  assert.deepEqual(baked.sort(), referenced.sort(), "unused maps in art/hero-live");
});

test("rigs are complete: two blinking eyes and a displacement body each", () => {
  for (const [id, rig] of Object.entries(rigs)) {
    assert.equal(rig.eyes.length, 2, id);
    for (const eye of rig.eyes) {
      assert.equal(eye.c.length, 2);
      assert.equal(eye.hs.length, 2);
      assert.ok(Number.isFinite(eye.tilt));
    }
    assert.match(rig.disp, /\bd\b/, id);
    assert.equal(typeof rig.fx, "string", id);
  }
});

test("live portrait is presentation-only and registered ahead of the hero screen", () => {
  assert.doesNotMatch(source, /\bgame\.|dispatch\(|EmberData|localStorage/);
  const template = read("src/template.html");
  const at = (token) => template.indexOf(`/*${token}*/`);
  assert.ok(at("CARD_RELIEF") > 0 && at("CARD_RELIEF") < at("HERO_LIVE_MAPS"));
  assert.ok(at("HERO_LIVE_MAPS") < at("HERO_LIVE_RIGS") && at("HERO_LIVE_RIGS") < at("HERO_LIVE"));
  assert.ok(at("HERO_LIVE") < at("SCREEN_HEROES"));
  // The hero screen falls back to the relief face when the portrait cannot mount.
  const screen = read("src/application/screens/heroes.js");
  assert.match(screen, /EmberHeroLive\.mount\([\s\S]*?\.then\(\(ok\) => ok \|\| reliefFace\(\)\)/);
  assert.match(screen, /face: false/);
});
