/* An illustration without baked live artwork silently keeps the relief face
 * (`EmberLiveArt.mount` resolves false). Surface a missing or stray one here. */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const campaign = require("../src/content/campaign.js");
const cards = require("../src/content/cards.js");
const maps = require("../src/live-art-maps.js");
const rigs = require("../src/presentation/live-art-rigs.js");
const auto = require("../src/live-art-auto.js");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/presentation/live-art.js");
const KINDS = ["bg", "body", "front", "depth", "ctrl", "flags"];

test("every card and selectable hero has live artwork, rigged by hand or automatically", () => {
  const known = new Set([...campaign.heroes.map((h) => h.portraitId), ...cards.map((c) => c.id)]);
  assert.deepEqual(Object.keys(maps).sort(), [...known].sort(), "Run tools/bake_live_art.py (--auto).");
  const hand = Object.keys(rigs).filter((id) => !rigs[id].auto);
  for (const id of Object.keys(maps))
    assert.ok(hand.includes(id) !== !!auto[id], id + ": exactly one of a hand rig or auto parameters");
  for (const id of Object.keys(rigs)) if (rigs[id].auto) assert.ok(auto[id], id + " adds to an auto rig that is missing");
  const referenced = [];
  for (const [id, set] of Object.entries(maps)) {
    assert.deepEqual(Object.keys(set), KINDS, id);
    for (const kind of KINDS) {
      assert.equal(set[kind], `asset:live-art/${id}-${kind}.webp`);
      assert.ok(fs.statSync(path.join(root, "art/live-art", `${id}-${kind}.webp`)).size > 100);
      referenced.push(`${id}-${kind}.webp`);
    }
  }
  const baked = fs.readdirSync(path.join(root, "art/live-art")).filter((f) => f.endsWith(".webp"));
  assert.deepEqual(baked.sort(), referenced.sort(), "unused maps in art/live-art");
});

test("auto parameters are complete and inside the picture", () => {
  for (const [id, a] of Object.entries(auto)) {
    assert.ok(["creature", "effect", "object"].includes(a.kind), id);
    assert.ok(["embers", "frost", "motes", "leaves", "none"].includes(a.particles), id);
    const [x0, y0, x1, y1] = a.box;
    assert.ok(0 <= x0 && x0 < x1 && x1 <= 1086 && 0 <= y0 && y0 < y1 && y1 <= 1448, id + " box");
    assert.ok(Number.isFinite(a.phase) && a.centre.every(Number.isFinite), id);
  }
  const kinds = { minion: "creature", spell: "effect", weapon: "object" };
  for (const card of cards) if (auto[card.id]) assert.equal(auto[card.id].kind, kinds[card.type], card.id);
});

test("hand rigs are complete: a pair of blinking eyes (or none) and a displacement body", () => {
  for (const [id, rig] of Object.entries(rigs)) {
    if (rig.auto) continue;
    assert.ok([0, 2].includes(rig.eyes.length), id);
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
  assert.ok(at("CARD_RELIEF") > 0 && at("CARD_RELIEF") < at("LIVE_ART_MAPS"));
  assert.ok(at("LIVE_ART_MAPS") < at("LIVE_ART_RIGS") && at("LIVE_ART_RIGS") < at("LIVE_ART_AUTO"));
  assert.ok(at("LIVE_ART_AUTO") < at("LIVE_ART"));
  assert.ok(at("LIVE_ART") < at("SCREEN_HEROES"));
  // The hero screen falls back to the relief face when the portrait cannot mount.
  const screen = read("src/application/screens/heroes.js");
  assert.match(screen, /EmberLiveArt\.mount\([\s\S]*?\.then\(\(ok\) => ok \|\| reliefFace\(\)\)/);
  assert.match(screen, /face: false/);
  // Cards presented on their own go through EmberLiveArt.mountCard; hand cards do not.
  for (const file of ["src/ui.js", "src/application/contracts.js", "src/presentation/card-stage.js"])
    assert.match(read(file), /EmberLiveArt\.mountCard\(/, file);
  assert.doesNotMatch(read("src/ui.js"), /EmberLiveArt\.mountCard\([^)]*\{[^}]*steer: "(held|drag)"/);
});
