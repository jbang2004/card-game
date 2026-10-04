"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  D = require("../src/data.js");
// The card artwork sources are not in the repository; the packed runtime bank
// is. Provenance checks need the sources, routing checks do not.
const manifestPath = path.join(root, "assets/anime/manifest.json");
const sources = fs.existsSync(manifestPath)
  ? {}
  : { skip: "assets/anime is not in the repository (see README 素材源)" };
const manifest = sources.skip
  ? { cards: 0, items: {}, sourceAtlases: 0 }
  : JSON.parse(fs.readFileSync(manifestPath, "utf8"));
let fallbackCalls = 0;
const ctx = vm.createContext({
  EmberData: D,
  document: { documentElement: { style: { setProperty() {} } } },
});
for (const name of [
  "anime-assets.js",
  "relic-assets.js",
  "character-catalog.js",
  "content/portraits.js",
  "content/story-art.js",
  "atelier-art.js",
  "art.js",
])
  vm.runInContext(fs.readFileSync(path.join(root, "src", name), "utf8"), ctx);
const evalJS = (code) => vm.runInContext(code, ctx);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
test("110 manifest entries match collectible, token, contract and opponent-card IDs", sources, () => {
  assert.equal(manifest.cards, 110);
  // 83 collectible cards of the heroes' classes + 13 opponent-only cards (class "foe")
  assert.equal(D.cards.filter((c) => !c.token && c.class !== "foe").length, 83);
  assert.equal(D.cards.filter((c) => c.class === "foe").length, 13);
  assert.equal(D.cards.filter((c) => c.token).length, 14);
  assert.deepEqual(
    Object.keys(manifest.items).sort(),
    D.cards.map((c) => c.id).sort(),
  );
});
test("Every output is distinct and matches its recorded file hash", sources, () => {
  const hashes = new Set();
  for (const [id, m] of Object.entries(manifest.items)) {
    const blob = fs.readFileSync(path.join(root, "assets/anime", m.file));
    assert.equal(sha(blob), m.sha256);
    hashes.add(m.sha256);
    assert.deepEqual(
      m.outputSize,
      D.byId[id].contract
        ? [768, 1024]
        : [336, 448],
    );
  }
  assert.equal(hashes.size, 110);
});
test("Every image retains verifiable source provenance", sources, () => {
  const atlases = new Set();
  for (const m of Object.values(manifest.items)) {
    const file = path.join(root, "assets/anime", m.source);
    assert.equal(sha(fs.readFileSync(file)), m.sourceSHA256);
    atlases.add(m.source);
    assert.ok(m.cropNativeSize[0] >= 336 && m.cropNativeSize[1] >= 448);
  }
  assert.equal(
    [...atlases].filter((s) => s.startsWith("sources/")).length,
    manifest.sourceAtlases,
  );
});
test("All 110 card routes resolve directly to their own embedded anime image", () => {
  fallbackCalls = 0;
  assert.ok(
    evalJS("EmberData.cards.every(c=>EmberArt.card(c)===AnimeAssets[c.id])"),
  );
  assert.equal(
    evalJS("new Set(EmberData.cards.map(c=>EmberArt.card(c))).size"),
    110,
  );
  assert.equal(fallbackCalls, 0);
});
test("Missing future card art fails visibly rather than reverting to old vectors", () => {
  assert.throws(
    () => evalJS("EmberArt.card({id:'unprovided-card'})"),
    /Missing anime artwork/,
  );
  assert.equal(fallbackCalls, 0);
});
test("Characters use explicit portrait IDs, independent of card ID or palette collisions", () => {
  // heroes and bosses have their own portraits (content/portraits.js); none of them is a card's art or a card id
  assert.ok(
    evalJS(
      "[...EmberData.heroes,...EmberData.bosses].every(h=>EmberArt.character(h)===EmberPortraits[h.portraitId].image&&!EmberData.byId[h.portraitId])",
    ),
  );
  assert.ok(
    evalJS("EmberArt.card(EmberData.byId.oracle)===AnimeAssets.oracle"),
  );
  assert.ok(
    evalJS("EmberArt.card(EmberData.byId.dragon)===AnimeAssets.dragon"),
  );
});
test("Every character and relic uses an explicit available image", () => {
  assert.ok(
    evalJS(
      "[...EmberData.heroes,...EmberData.bosses].every(h=>EmberArt.character(h).startsWith('asset:portraits/'))",
    ),
  );
  for (const [id, p] of Object.entries(vm.runInContext("EmberPortraits", ctx)))
    assert.ok(
      fs.existsSync(path.join(root, "art", p.image.slice("asset:".length))) ||
        fs.existsSync(path.join(root, "assets", p.image.slice("asset:".length))),
      id + ": portrait image is missing",
    );
  assert.ok(
    evalJS(
      'EmberData.relics.every(r=>/^(data:image\\/|asset:ui\\/relics-v3\\/)/.test(EmberArt.relic(r.id)))',
    ),
  );
  // the story's own pictures (scenes, events, keepsakes) are files of the repository
  const story = vm.runInContext("EmberStoryArt", ctx);
  for (const group of Object.values(story))
    for (const [id, src] of Object.entries(group))
      assert.ok(fs.existsSync(path.join(root, "art", src.slice("asset:".length))), id + ": story picture is missing");
  for (const ev of Object.values(D.story.events)) assert.ok(story.events[ev.art], ev.title + ": no picture");
  for (const act of D.dungeon.acts) assert.ok(story.scenes[act.scene], act.id + ": no scene");
});
test("All focal calibrations are valid and bounded to small non-distorting overscan", () => {
  for (const c of D.cards)
    for (const mode of ["card", "minion", "hero", "option"]) {
      const f = evalJS(`AtelierArt.framing('${c.id}','${mode}')`);
      assert.ok(/^50% \d+%$/.test(f.pos));
      assert.ok(f.scale >= 1 && f.scale <= 1.04);
    }
});

test("the complete catalog matches game IDs and publishes immutable runtime metadata", () => {
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, "config/characters.json")),
  );
  assert.deepEqual(
    Object.keys(catalog.cards).sort(),
    D.cards.map((c) => c.id).sort(),
  );
  assert.ok(evalJS("Object.isFrozen(CharacterCatalog.wolf)"));
  assert.equal(
    evalJS('Object.keys(CharacterCatalog.wolf).join(",")'),
    "staticKey,focus",
  );
  for (const [id, c] of Object.entries(catalog.cards)) {
    assert.equal(c.staticKey, id);
    assert.equal(evalJS(`AtelierArt.focuses['${id}']`), c.focus);
  }
});

test("catalog validation rejects missing IDs, wrong artwork, invalid focus and stray fields", sources, () => {
  const { execFileSync } = require("node:child_process");
  execFileSync(
    "python3",
    [
      "-c",
      `
import copy,json
from tools.characters import validate,generate
base=json.load(open('config/characters.json'))
generate(check=True)
for change in ['missing','static','focus','extra','version']:
 d=copy.deepcopy(base)
 if change=='missing': del d['cards']['wolf']
 if change=='static': d['cards']['wolf']['staticKey']='oracle'
 if change=='focus': d['cards']['wolf']['focus']=200
 if change=='extra': d['cards']['wolf']['motion']={}
 if change=='version': d['version']=2
 try: validate(d)
 except ValueError: pass
 else: raise AssertionError(change+' was accepted')
 `,
    ],
    { cwd: root },
  );
});
