/* A card without relief maps silently keeps its flat artwork
 * (`EmberCardRelief.mount` returns false). That is the right runtime behaviour
 * and a bad way to discover a new card or hero whose maps were never baked, so
 * the mismatch surfaces here instead. */
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const cards = require("../src/content/cards.js");
const campaign = require("../src/content/campaign.js");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const source = read("src/presentation/card-relief.js");
const maps = new Function(
  read("src/card-relief-maps.js") + ";return EmberCardReliefMaps;",
)();

test("relief maps cover every card illustration exactly", () => {
  const expected = cards.map((c) => c.id).sort();
  assert.deepEqual(
    Object.keys(maps).sort(),
    expected,
    "Run tools/bake_card_relief.py --cards (it also rewrites src/card-relief-maps.js).",
  );
  assert.ok(expected.length >= 79);
  const referenced = new Set();
  for (const [id, set] of Object.entries(maps)) {
    assert.ok(set.height && set.orm, id + " needs height and orm");
    for (const [kind, uri] of Object.entries(set)) {
      assert.equal(uri, `asset:relief/${id}-${kind}.webp`);
      const file = uri.slice("asset:".length);
      assert.ok(fs.statSync(path.join(root, "art", file)).size > 100, file);
      referenced.add(path.basename(file));
    }
  }
  // The shared studio environment (tools/bake_relief_studio.py) is the only other file.
  assert.match(source, /"asset:relief\/studio\.webp"/);
  const baked = fs
    .readdirSync(path.join(root, "art/relief"))
    .filter((f) => f.endsWith(".webp") && f !== "studio.webp");
  assert.deepEqual(baked.sort(), [...referenced].sort(), "unused maps in art/relief");
});

test("selectable hero portraits are shown large, so they carry a baked normal map", () => {
  for (const hero of campaign.heroes)
    assert.ok(maps[hero.portraitId]?.normal, hero.portraitId);
});

test("relief is presentation-only and registered ahead of its callers", () => {
  assert.doesNotMatch(source, /\bgame\.|dispatch\(|EmberData|localStorage/);
  const template = read("src/template.html");
  const at = (token) => template.indexOf(`/*${token}*/`);
  assert.ok(at("CARD_RELIEF_MAPS") > 0 && at("CARD_RELIEF_MAPS") < at("CARD_RELIEF"));
  assert.ok(at("CARD_RELIEF") < at("SCREEN_HEROES") && at("CARD_RELIEF") < at("UI"));
  // Every material tier named by the content has a finish.
  const finishes = source.match(/const FINISH = \{([\s\S]*?)\};/)[1];
  for (const rarity of new Set(cards.map((c) => c.rarity)))
    assert.match(finishes, new RegExp("\\b" + rarity + ":"), rarity);
});
