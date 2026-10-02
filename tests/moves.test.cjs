// Move sheets (docs/design/MOVES.md): content/moves.js is the one place a figure's motion and effects are tuned;
// EmberMoveSheet compiles it into the suites and recipes the battlefield plays. The sheets must be well formed (known
// keys, real clips and palettes, real figures), agree with the director's own beats, and compile to what the figures
// read.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = (f) => path.join(ROOT, "src", f);
const read = (f) => fs.readFileSync(SRC(f), "utf8");
global.EmberTiming = require(SRC("presentation/timing.js"));
const SHEETS = require(SRC("content/moves.js"));
const MS = require(SRC("presentation/voxel/movesheet.js"));
const ANIMS = new Function(read("presentation/voxel/model-anims.js") + "\nreturn EmberModelAnims;")();
const CLIPS = Object.fromEntries(Object.entries(ANIMS).map(([k, v]) => [k, v.n]));
const PALETTES = [...read("presentation/voxel/skillfx.js").matchAll(/^    (\w+): \{ core: /gm)].map((m) => m[1]);
const BUILT = MS.use(SHEETS);
const figures = Object.keys(SHEETS.figures);
const sheet = (id) => MS.resolve(SHEETS, id);

test("the sheets are well formed: known keys, real clips, real palettes", () => {
  assert.ok(PALETTES.length >= 20, "the palettes were read from EmberSkillFx");
  assert.deepEqual(MS.validate(SHEETS, { clips: CLIPS, palettes: PALETTES }), []);
});

test("a mistake in a sheet is named", () => {
  const bad = { archetypes: { melee: { kind: "melee" } }, figures: {
    a: { base: "melee", clips: { idle: "st_idle", attack: "nope", hurt: "mu_hit", victory: "vc_pump" }, atack: {} },
    b: { base: "melee", clips: { idle: "st_idle", attack: "ss_down", hurt: "mu_hit", victory: "vc_pump" },
      attack: { before: { coil: { ms: 100, frame: 999, ease: "zz" } }, dash: { kind: "hop", ms: 500 }, hitstop: [1, 2] }, fx: { palette: "plaid", hit: { mark: "smear", sprks: 1, shock: true } } },
    c: { base: "nowhere" },
  } };
  const said = MS.validate(bad, { clips: CLIPS, palettes: PALETTES }).join("\n");
  for (const want of ['a: unknown key "atack"', 'clip "nope"', "frame 999 is outside", 'ease "zz"', 'attack.dash.kind "hop"', "shorter than the director", "longer than its lead", "hitstop is",
    'fx.palette "plaid"', 'fx.hit.mark "smear"', 'unknown key "sprks"', "fx.hit.shock is always on", 'no base "nowhere"']) assert.ok(said.includes(want), `says: ${want}\n${said}`);
});

test("the director's beats the sheets count on are the director's", () => {
  const T = EmberTiming.attack;
  assert.deepEqual({ ...MS.DIRECTOR }, { lift: T.lift, lunge: T.lunge, recoil: T.rangedRecoil });
  // the fallback (the gallery and the review page load no EmberTiming) is written out in movesheet.js: keep it equal
  const m = read("presentation/voxel/movesheet.js").match(/\|\| \{ lift: (\d+), lunge: (\d+), rangedRecoil: (\d+) \}/);
  assert.deepEqual(m.slice(1).map(Number), [T.lift, T.lunge, T.rangedRecoil]);
});

test("every sheet stands for a figure of the build, and moves the way its figure attacks", () => {
  global.self = global;
  global.EmberSculpt = require(SRC("presentation/voxel/sculpt.js"));
  global.EmberMeshSimplify = require(SRC("presentation/voxel/simplify.js"));
  global.EmberVoxelKit = require(SRC("presentation/voxel/kit.js"));
  global.EmberVoxel = require(SRC("presentation/voxel/voxelize.js"));
  const build = JSON.parse(fs.readFileSync(path.join(ROOT, "config/build.json"), "utf8"));
  for (const t of Object.keys(build).filter((k) => k.startsWith("VOXEL_FIG_"))) require(SRC(build[t]));
  const KIT = global.EmberVoxelKit, odd = [];
  for (const id of figures) {
    const spec = KIT.get(id);
    assert.ok(spec, `${id} is a figure of the build`);
    const shoots = !!spec.moves?.attack?.ranged, kind = sheet(id).kind;
    if (kind !== "beast" && shoots !== (kind === "caster" || kind === "archer")) odd.push(id);
  }
  assert.deepEqual(odd, [], "a melee sheet on a figure that shoots (or the reverse) plays its clip squeezed onto the wrong beats");
});

test("a sheet compiles to the suite its figure plays: phases in ms become the signature's keys", () => {
  const s = BUILT.SUITES.paladin, g = s.sig;
  assert.deepEqual([s.idle, s.attack, s.hurt, s.victory], ["st_axe", "ss_power", "ss_impact", "vc_raise_hand"]);
  assert.equal(g.lead, 600); assert.equal(g.windup, 340);
  assert.deepEqual(g.pre, [[0, 0], [0.22, 11, "io"], [0.3, 12.5, "o"], [0.8, 28, "o"], [1, 33, "i3"]]);
  assert.deepEqual(g.post, [[0, 33], [0.1, 37, "o"], [0.36, 41, "io"]]);
  assert.deepEqual([g.rise, g.back, g.leap, g.reach, g.dash], [0.34, 0.32, 0.3, 0.42, "leap"]);
  assert.deepEqual(g.hitstop, [0, 3, 5, 7]);
  assert.deepEqual(g.flourish, { clip: "gs_pose", every: [9, 14], keys: [[0, 0], [0.85, 30, "io"], [2.3, 58, "io"]], fade: [0.35, 0.55] });
  assert.deepEqual(g.fx, { pal: "holy", sigil: "sun", ground: "crack", bits: "feather", hurt: "shield", aura: { bits: "sparkle" } });
  assert.deepEqual(g.phases, { pre: ["coil", "hold", "spring", "strike"], post: ["follow", "settle"] });
  assert.deepEqual(s.plain, { attack: "gs_downward_slash", hurt: "gs_impact" });
});

test("every signature's timing holds together", () => {
  const D = MS.DIRECTOR;
  for (const [id, s] of Object.entries(BUILT.SUITES)) {
    const g = s.sig, kind = sheet(id).kind;
    assert.ok(g, `${id} has a signature (without one its blows fall back on the sculpts' pixel sparks)`);
    assert.equal(g.pre[0][0], 0, id); assert.equal(g.pre[g.pre.length - 1][0], 1, `${id}: its phases end on the blow`);
    for (let i = 1; i < g.pre.length; i++) assert.ok(g.pre[i][0] > g.pre[i - 1][0], `${id}: pre runs forward`);
    for (let i = 1; i < g.post.length; i++) assert.ok(g.post[i][0] > g.post[i - 1][0], `${id}: post runs forward`);
    assert.equal(g.post[0][1], g.pre[g.pre.length - 1][1], `${id}: the landing starts on the blow's frame`);
    assert.ok(g.rise >= 0 && g.back >= 0, id);
    if (kind === "melee") assert.equal(g.windup, g.lead - D.lift - D.lunge, `${id}: its wind-up is what the director's lift and lunge leave of its lead`);
    else if (kind === "archer") assert.equal(g.draw, g.lead - D.recoil, id);
    else assert.equal(s.spell.windup, g.lead - D.recoil, `${id}: its spell charges for its lead less the recoil`);
    if (g.leap !== undefined) assert.ok(g.leap >= 0 && g.leap < 1, `${id}: it leaves its station before the blow`);
    if (g.hitstop) assert.equal(g.hitstop.length, 4, id);
  }
  for (const [id, b] of Object.entries(BUILT.BEASTS)) {
    const g = b.sig;
    assert.deepEqual(g.post[0], [0, 0], id); assert.equal(g.post.length, 2, id);
    assert.ok(g.stay || g.draw !== undefined || (g.dash && g.leap > 0 && g.leap < 1), `${id}: it dashes, shoots or stays`);
    assert.ok(g.fx?.pal, `${id} has a palette`);
  }
});

test("a figure inherits from its archetype; null takes away, _replace replaces, a figure can stand on a figure", () => {
  assert.deepEqual(MS.bases("recruit"), ["swordShield", "melee"]);
  assert.deepEqual(sheet("ada").body, { lower: ["attack"] }, "its archetype's body, kept");
  assert.deepEqual(sheet("recruit").attack.dash, { ...SHEETS.archetypes.swordShield.attack.dash, reach: 0.48 }, "one number of its own, the rest its archetype's");
  assert.equal(sheet("recruit").attack.before.coil.ms, SHEETS.archetypes.swordShield.attack.before.coil.ms);
  assert.deepEqual(BUILT.SUITES.mirrornahira, BUILT.SUITES.nahira);
  const S = { archetypes: { x: { kind: "melee", attack: { before: { a: { ms: 100, frame: 1 }, b: { ms: 200, frame: 2 } }, hitstop: [1, 2, 3] }, fx: { hit: { ground: "crack", rocks: 3 } } } },
    figures: { f: { base: "x", attack: { before: { b: { ms: 300 } } }, fx: { hit: { rocks: null } } }, g: { base: "x", attack: { before: { _replace: true, c: { ms: 400, frame: 9 } } } } } };
  assert.deepEqual(MS.resolve(S, "f").attack.before, { a: { ms: 100, frame: 1 }, b: { ms: 300, frame: 2 } });
  assert.deepEqual(MS.resolve(S, "f").fx, { hit: { ground: "crack" } });
  assert.deepEqual(MS.resolve(S, "g").attack.before, { c: { ms: 400, frame: 9 } });
  assert.throws(() => MS.resolve({ archetypes: { a: { base: "b" }, b: { base: "a" } }, figures: {} }, "a"), /loop/);
});

test("an effect given as { kind, size, gain, life, count } is that effect tuned", () => {
  const fx = MS.fxRecipe({ palette: "frost", charge: { sigil: { kind: "rune", size: 1.4 }, stream: { count: 0.5 } }, weapon: { trail: { from: 0.6, gain: 1.5 } },
    hit: { ground: { kind: "frost", size: 0.5, life: 2 }, beam: { size: 0.8 }, shock: { size: 1.2 }, mark: false }, victory: { ray: false, orb: { kind: "moon", size: 2 } }, idle: { bits: "snow", halo: { gain: 0.5 } } });
  assert.deepEqual(fx, { pal: "frost", sigil: "rune", slash: false, beam: true, ground: "frost", trailFrom: 0.6, victory: { ray: false, orb: "moon" }, aura: { bits: "snow", halo: true },
    tune: { sigil: { size: 1.4 }, stream: { count: 0.5 }, trail: { gain: 1.5 }, shock: { size: 1.2 }, beam: { size: 0.8 }, ground: { size: 0.5, life: 2 }, orb: { size: 2 }, halo: { gain: 0.5 } } });
});

test("the timeline names every phase on one clock", () => {
  const t = MS.timeline(sheet("paladin"));
  assert.equal(t.lead, 600); assert.equal(t.total, 1620);
  assert.deepEqual(t.phases.map((p) => [p.id, p.label, p.t0, p.t1]), [["coil", "蓄力", 0, 132], ["hold", "蓄满", 132, 180], ["spring", "腾空", 180, 480], ["strike", "出手", 480, 600],
    ["follow", "随势", 600, 700], ["settle", "定格", 700, 960], ["rise", "起身", 960, 1300], ["home", "回位", 1300, 1620]]);
  assert.deepEqual(t.dash, { t0: 180, t1: 600, kind: "leap" });
  for (const id of figures) {
    const s = sheet(id);
    for (const side of ["before", "after"]) for (const pid of Object.keys(s.attack?.[side] || {})) assert.ok(MS.LABELS.phase[pid] || s.attack[side][pid].label, `${id}: the phase "${pid}" has a name`);
    for (const e of MS.effects(s)) assert.ok(e.label && e.label !== e.key, `${id}: the effect ${e.group}.${e.key} has a name`);
  }
});
