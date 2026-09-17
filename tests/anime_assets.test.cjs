"use strict";
const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  crypto = require("node:crypto");
const root = path.resolve(__dirname, ".."),
  D = require("../src/data.js");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "assets/anime/manifest.json"), "utf8"),
);
let fallbackCalls = 0;
const ctx = vm.createContext({
  EmberData: D,
  document: { documentElement: { style: { setProperty() {} } } },
});
for (const name of [
  "anime-assets.js",
  "relic-assets.js",
  "character-catalog.js",
  "atelier-art.js",
  "art.js",
])
  vm.runInContext(fs.readFileSync(path.join(root, "src", name), "utf8"), ctx);
const evalJS = (code) => vm.runInContext(code, ctx);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
test("79 manifest entries match collectible, token and contract IDs", () => {
  assert.equal(manifest.cards, 79);
  assert.equal(D.cards.filter((c) => !c.token).length, 65);
  assert.equal(D.cards.filter((c) => c.token).length, 14);
  assert.deepEqual(
    Object.keys(manifest.items).sort(),
    D.cards.map((c) => c.id).sort(),
  );
});
test("Every output is distinct and matches its recorded file hash", () => {
  const hashes = new Set();
  const heroPortraits = new Set(D.heroes.map((hero) => hero.portraitId));
  for (const [id, m] of Object.entries(manifest.items)) {
    const blob = fs.readFileSync(path.join(root, "assets/anime", m.file));
    assert.equal(sha(blob), m.sha256);
    hashes.add(m.sha256);
    assert.deepEqual(
      m.outputSize,
      D.byId[id].contract || heroPortraits.has(id)
        ? [768, 1024]
        : [336, 448],
    );
  }
  assert.equal(hashes.size, 79);
});
test("Every image retains verifiable source provenance", () => {
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
test("All 79 card routes resolve directly to their own embedded anime image", () => {
  fallbackCalls = 0;
  assert.ok(
    evalJS("EmberData.cards.every(c=>EmberArt.card(c)===AnimeAssets[c.id])"),
  );
  assert.equal(
    evalJS("new Set(EmberData.cards.map(c=>EmberArt.card(c))).size"),
    79,
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
  assert.ok(
    evalJS("EmberArt.character(EmberData.bosses[2])===AnimeAssets.necromancer"),
  );
  assert.ok(
    evalJS("EmberArt.card(EmberData.byId.oracle)===AnimeAssets.oracle"),
  );
  assert.ok(
    evalJS("EmberArt.character(EmberData.bosses[4])===AnimeAssets.ashdragon"),
  );
  assert.ok(
    evalJS("EmberArt.card(EmberData.byId.dragon)===AnimeAssets.dragon"),
  );
});
test("Every character and relic uses an explicit available image", () => {
  assert.ok(
    evalJS(
      "[...EmberData.heroes,...EmberData.bosses].every(h=>Object.values(AnimeAssets).includes(EmberArt.character(h)))",
    ),
  );
  assert.ok(
    evalJS(
      'EmberData.relics.every(r=>EmberArt.relic(r.id).startsWith("data:image/"))',
    ),
  );
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
    fs.readFileSync(path.join(root, "assets/characters.json")),
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

test("catalog validation rejects missing IDs, wrong artwork, invalid focus and stray fields", () => {
  const { execFileSync } = require("node:child_process");
  execFileSync(
    "python3",
    [
      "-c",
      `
import copy,json
from tools.characters import validate,generate
base=json.load(open('assets/characters.json'))
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
