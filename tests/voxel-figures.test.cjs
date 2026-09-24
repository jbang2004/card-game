// Voxel battlefield figures (docs/design/MINIATURES.md): every figure registered in the build loads, stands for real
// cards (or a real hero), declares an attack the stage and the planner understand, and bakes within the budget:
// ≤ 12000 visible voxels and ≤ 45000 triangles for the body, ≤ 2000 voxels per prop.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = (f) => path.join(ROOT, "src", f);
global.self = global;
global.EmberSculpt = require(SRC("presentation/voxel/sculpt.js"));
global.EmberVoxelKit = require(SRC("presentation/voxel/kit.js"));
global.EmberVoxel = require(SRC("presentation/voxel/voxelize.js"));
const D = require("../src/data.js");
const build = JSON.parse(fs.readFileSync(path.join(ROOT, "config/build.json"), "utf8"));
const template = fs.readFileSync(SRC("template.html"), "utf8");
const figureTokens = Object.keys(build).filter((k) => k.startsWith("VOXEL_FIG_"));
for (const token of figureTokens) require(SRC(build[token]));
const KIT = global.EmberVoxelKit;
const STYLES = new Set(["slash", "thrust", "blunt", "bite", "breath", "bolt", "arrow"]);
const BODY_V = 0.0125, PROP_V = 0.0075;             // EmberVoxelRender.V / VPROP

test("every figure file in the build is on the page, before the renderer, and registers one figure", () => {
  assert.ok(figureTokens.length >= 4);
  const at = (token) => template.indexOf(`/*${token}*/`);
  for (const token of figureTokens) {
    assert.ok(at(token) > at("VOXEL_KIT"), `${token} is on the page after the kit`);
    assert.ok(at(token) < at("VOXEL_RENDER"), `${token} is on the page before the renderer`);
  }
  assert.equal(KIT.ids().length, figureTokens.length);
  const onDisk = fs.readdirSync(SRC("presentation/voxel/figures")).filter((f) => f.endsWith(".js"));
  assert.deepEqual(onDisk.map((f) => "presentation/voxel/figures/" + f).sort(), figureTokens.map((t) => build[t]).sort(), "every figure file is registered");
});

test("figures stand for real cards and heroes, one figure per card", () => {
  const seen = new Map();
  for (const id of KIT.ids()) {
    const spec = KIT.get(id);
    assert.ok(spec.cards.length > 0, `${id} names its cards`);
    for (const card of spec.cards) {
      if (card.startsWith("hero:")) assert.ok(D.heroes.some((h) => h.id === card.slice(5)), `${id}: hero ${card} exists`);
      else assert.ok(D.byId[card], `${id}: card ${card} exists`);
      assert.ok(!seen.has(card), `${card} has one figure (${seen.get(card)} and ${id})`);
      seen.set(card, id);
      assert.equal(KIT.forCard(card).id, id);
    }
  }
});

test("each figure declares an attack the battlefield can play", () => {
  for (const id of KIT.ids()) {
    const a = KIT.get(id).moves?.attack;
    assert.ok(a && a.clip, `${id} has moves.attack.clip`);
    assert.ok(STYLES.has(a.style), `${id}: attack style ${a.style} is one of ${[...STYLES].join(" ")}`);
    if (a.trail) {
      assert.ok(a.trail.prop || a.trail.bone, `${id}: the weapon trail names a prop or a bone`);
      assert.equal(a.trail.from.length, 3); assert.equal(a.trail.to.length, 3);
    }
    if (a.hit !== undefined) assert.ok(a.hit > 0 && a.hit < (a.length ?? 1.3), `${id}: contact lands inside the clip`);
    if (a.ranged) assert.ok(["breath", "bolt", "arrow"].includes(a.style), `${id}: a ranged attack shoots something`);
  }
});

for (const id of KIT.ids()) {
  test(`${id} bakes within the voxel budget`, () => {
    const spec = KIT.get(id), ch = spec.build(spec.fam);
    const body = global.EmberVoxel.voxelize(ch.sc, { v: BODY_V });
    assert.ok(body.stats.voxels > 800, `${id}: a real figure (${body.stats.voxels} voxels)`);
    assert.ok(body.stats.voxels <= 12000, `${id}: ${body.stats.voxels} voxels ≤ 12000`);
    assert.ok(body.stats.tris <= 45000, `${id}: ${body.stats.tris} triangles ≤ 45000`);
    for (const [i, p] of (ch.props || []).entries()) {
      const prop = global.EmberVoxel.voxelize(p.sc, { v: PROP_V, dilate: { body: 0.5 } });
      assert.ok(prop.stats.voxels <= 2000, `${id} prop ${p.grip || i}: ${prop.stats.voxels} voxels ≤ 2000`);
    }
    if (spec.moves.attack.trail?.bone) assert.ok(body.bones.some((b) => b.name === spec.moves.attack.trail.bone), `${id}: trail bone exists`);
    if (spec.moves.attack.emitter) assert.ok(body.bones.some((b) => b.name === spec.moves.attack.emitter.bone), `${id}: emitter bone exists`);
  });
}
