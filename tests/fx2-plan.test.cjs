/* EmberFx2Engine.plan() 与引擎时钟的一致性（BATTLE_PRESENTATION_V2 §3.3 / §4.2）。
 *
 * plan 是纯函数：node 里直接 require，不需要 WebGL。createSim 是引擎里与 GL 无关的
 * 那一半（实例、粒子、时钟、冲击队列），接一个只记几何的 sink 就能在 node 里跑，
 * 用它证明"画面的接触帧 = plan().hitAt（误差 < 1 帧）"与"250ms 内完全消失"。
 * 像素级的同一组断言在浏览器里由 tools/fx2-measure.cjs 跑。 */
const test = require("node:test"),
  assert = require("node:assert/strict");
const T = require("../src/presentation/timing.js");
const E = require("../src/fx2-engine.js");

const HERO = { x: 110, y: 619, w: 148, h: 223 };
const MID = { x: 800, y: 295, w: 116, h: 146 };
const ROW = [{ x: 668, y: 295, w: 116, h: 146 }, MID, { x: 932, y: 295, w: 116, h: 146 }];
const FRIEND = { x: 800, y: 459, w: 116, h: 146 };
const FRAME = 1000 / 60;
const ATTACKS = ["slash", "claw", "slam", "arrow", "spear", "bolt", "breath"];
const SPELLS = E.SKILL_ORDER.filter((k) => !ATTACKS.includes(k) && k !== "contact");
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inBox = (p, b, tol = 2) =>
  Math.abs(p[0] - b.x) <= b.w / 2 + tol && Math.abs(p[1] - b.y) <= b.h / 2 + tol;

function recorder() {
  const rec = { quads: 0, strips: 0 };
  return {
    rec,
    sink: {
      quad() { rec.quads++; },
      strip() { rec.strips++; },
    },
  };
}

/** 施放一次并逐帧推进，返回 trace、每帧接触层绘制数与结束时刻。 */
function run(kind, dts) {
  const { rec, sink } = recorder();
  const sim = E.createSim({ sink });
  sim.sim.trace = [];
  let plan;
  let from = HERO;
  let targets = [MID];
  if (kind === "contact") plan = sim.contact({ at: MID, tier: 3, seed: 1 });
  else if (ATTACKS.includes(kind)) {
    from = FRIEND;
    plan = sim.attack(kind, { from, to: MID, tier: 3, seed: 1 });
  } else if (kind === "frost-field") {
    targets = ROW;
    plan = sim.cast(kind, { from, targets, aoe: true, tier: 3, seed: 1 });
  } else plan = sim.cast(kind, { from, targets, tier: 3, seed: 1 });
  const frames = [];
  let t = 0;
  let i = 0;
  while ((sim.busy() || t < plan.duration + 50) && t < 3000) {
    const dt = dts[i++ % dts.length];
    sim.step(dt);
    t += dt;
    sim.collect(); // 全部层：路径几何进 trace
    const trace = sim.sim.trace;
    sim.sim.trace = null;
    sim.sim.debugLayer = "contact";
    rec.quads = 0;
    rec.strips = 0;
    sim.collect();
    const contactDraws = rec.quads + rec.strips;
    sim.sim.debugLayer = null;
    sim.sim.trace = trace;
    frames.push({ t, dt, contactDraws, busy: sim.busy() });
  }
  return { sim, plan, trace: sim.sim.trace, frames, from, targets };
}

test("plan follows the §4.2 timing rules", () => {
  const S = T.spell, A = T.attack;
  // 单体弹道：施法闪 + 距离 / 1400px/s，钳到 160–320
  const far = E.plan("fireball", { from: HERO, targets: [MID] });
  assert.equal(far.hitAt[0], Math.round(S.castFlash + clamp(dist(HERO, MID) / S.projectileSpeed * 1000, S.projectileMin, S.projectileMax)));
  assert.equal(far.hitAt[0], S.castFlash + S.projectileMax);
  const near = E.plan("frost", { from: FRIEND, targets: [MID] });
  assert.equal(near.hitAt[0], S.castFlash + S.projectileMin);
  const mid = E.plan("frost", { from: { x: 500, y: 295 }, targets: [MID] });
  assert.equal(mid.hitAt[0], Math.round(S.castFlash + 300 / S.projectileSpeed * 1000));
  // 单体非弹道：施法闪 + 连线 = 260
  for (const k of ["holy", "void", "nature", "lightning", "siphon", "arcane", "bladeCross"]) {
    assert.deepEqual(E.plan(k, { from: HERO, targets: [MID] }).hitAt, [S.castFlash + S.link], k);
  }
  // 平砍：近战 0；远程按 1800px/s 钳 90–220
  assert.deepEqual(E.plan("slash", { from: FRIEND, targets: [MID], ranged: false }).hitAt, [0]);
  assert.deepEqual(E.plan("claw", { from: FRIEND, to: MID, attack: true }).hitAt, [0]);
  assert.deepEqual(E.plan("arrow", { from: FRIEND, targets: [MID], ranged: true }).hitAt,
    [Math.round(clamp(164 / A.rangedSpeed * 1000, A.rangedMin, A.rangedMax))]);
  assert.deepEqual(E.plan("bolt", { from: HERO, to: MID, attack: true }).hitAt, [A.rangedMax]);
  assert.deepEqual(E.plan("spear", { from: FRIEND, to: { x: 810, y: 330 }, attack: true }).hitAt, [A.rangedMin]);
  // contact：0
  assert.deepEqual(E.plan("contact", { at: MID }).hitAt, [0]);
  // duration = max(hitAt) + residueMaxMs
  assert.equal(far.duration, far.hitAt[0] + T.residueMaxMs);
});

test("group plans stagger by distance, capped at staggerSteps", () => {
  const S = T.spell;
  // 输入顺序打乱：由近及远排名，hitAt 与输入同序
  const from = { x: 0, y: 295, w: 100, h: 100 };
  const targets = [8, 3, 0, 5, 1, 7, 2, 6, 4].map((i) => ({ x: 200 + i * 100, y: 295, w: 90, h: 120 }));
  const p = E.plan("holy", { from, targets, aoe: true });
  targets.forEach((t, i) => {
    const rank = (t.x - 200) / 100;
    assert.equal(p.hitAt[i], S.castFlash + Math.min(rank, T.staggerSteps) * T.stagger, `target ${i}`);
  });
  assert.equal(Math.max(...p.hitAt), S.castFlash + T.staggerSteps * T.stagger);
  // 多目标即群体；frost-field 即使单目标也是群体
  assert.deepEqual(E.plan("fireball", { from, targets: targets.slice(0, 2) }).hitAt.slice().sort((a, b) => a - b),
    [S.castFlash, S.castFlash + T.stagger]);
  assert.deepEqual(E.plan("frost-field", { from, targets: [MID] }).hitAt, [S.castFlash]);
  // 同距离按输入顺序
  const tie = E.plan("void", { from: { x: 0, y: 0 }, targets: [{ x: 100, y: 0 }, { x: 0, y: 100 }] });
  assert.deepEqual(tie.hitAt, [S.castFlash, S.castFlash + T.stagger]);
});

test("timeScale compresses hitAt, residue and the instance clock together", () => {
  const p1 = E.plan("fireball", { from: HERO, targets: [MID] });
  const p2 = E.plan("fireball", { from: HERO, targets: [MID], timeScale: 0.5 });
  assert.equal(p2.hitAt[0], Math.round(p1.hitAt[0] * 0.5));
  assert.equal(p2.duration, p2.hitAt[0] + Math.round(T.residueMaxMs * 0.5));
  assert.deepEqual(E.plan("holy", { from: HERO, targets: [MID], timeScale: 3 }), E.plan("holy", { from: HERO, targets: [MID] }));
  const sim = E.createSim({});
  sim.sim.trace = [];
  const p = sim.cast("fireball", { from: HERO, targets: [MID], timeScale: 0.5 });
  let t = 0;
  while (sim.busy() && t < 2000) { sim.step(FRAME); t += FRAME; }
  const c = sim.sim.trace.find((e) => e.type === "contact");
  assert.ok(c.real - p.hitAt[0] >= 0 && c.real - p.hitAt[0] < FRAME);
  assert.ok(t <= p.duration + FRAME + 1e-6, `idle by ${p.duration}ms, got ${t}`);
});

test("plan is pure: no WebGL, no input mutation, deterministic", () => {
  const input = { from: { ...HERO }, targets: ROW.map((b) => ({ ...b })), aoe: true, tier: 3 };
  const snapshot = JSON.stringify(input);
  const a = E.plan("frost-field", input);
  const b = E.plan("frost-field", input);
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(typeof globalThis.WebGLRenderingContext, "undefined");
});

for (const kind of E.SKILL_ORDER) {
  test(`${kind}: contact frame matches plan().hitAt within one frame, visuals gone by +residueMaxMs`, () => {
    for (const dts of [[FRAME], [12, 22], [8.3]]) {
      const maxDt = Math.max(...dts);
      const r = run(kind, dts);
      const contacts = r.trace.filter((e) => e.type === "contact");
      assert.equal(contacts.length, r.plan.hitAt.length, "one contact per target");
      for (const c of contacts) {
        assert.ok(c.real - c.hit >= -1e-6 && c.real - c.hit < maxDt + 1e-6,
          `contact real ${c.real} vs hitAt ${c.hit} (dt ${dts})`);
        assert.ok(c.natural >= c.impact - 1e-6, "natural clock reached the skill's impact mark");
      }
      // 接触帧（第一个 real ≥ hitAt 的帧）接触层有画面
      const first = Math.min(...r.plan.hitAt);
      const hitFrame = r.frames.find((f) => f.t >= first - 1e-6);
      assert.ok(hitFrame.contactDraws > 0, `contact layer draws on the contact frame (dt ${dts})`);
      // 接触后 residueMaxMs + 一帧：什么都不剩
      const last = Math.max(...r.plan.hitAt);
      const after = r.frames.find((f) => f.t >= last + T.residueMaxMs + maxDt);
      assert.ok(after && !after.busy, `idle after +${T.residueMaxMs}ms (dt ${dts})`);
      assert.equal(r.sim.particles.count, 0);
    }
  });
}

for (const kind of [...SPELLS, "arrow", "spear", "bolt", "breath"]) {
  test(`${kind}: path geometry starts inside the caster box and ends inside a target box`, () => {
    const r = run(kind, [FRAME]);
    const paths = r.trace.filter((e) => e.type === "path");
    assert.ok(paths.length > 0, "has a visible path segment");
    const firstT = paths[0].real;
    const firstRecs = paths.filter((p) => p.real === firstT);
    assert.ok(firstRecs.some((p) => inBox(p.a, r.from) || inBox(p.b, r.from)),
      `first path frame starts in caster box: ${JSON.stringify(firstRecs.map((p) => p.a))}`);
    for (const [i, hit] of r.plan.hitAt.entries()) {
      const box = r.targets[i];
      const near = paths.filter((p) => Math.abs(p.real - hit) <= 2 * FRAME);
      assert.ok(near.some((p) => inBox(p.a, box) || inBox(p.b, box)),
        `path reaches target ${i} around its contact`);
    }
  });
}

test("impulse applies the tier table: shake, hit-stop, edge flash, push only when cinematic", () => {
  const { rec, sink } = recorder();
  const sim = E.createSim({ sink });
  for (const tier of [1, 2, 3]) {
    sim.reset();
    const tt = T.tiers[tier];
    const out = sim.impulse({ at: MID, tier });
    assert.deepEqual(out, { hitStopMs: tt.hitStopMs, shakeMs: tt.shakeMs, shakePx: tt.shakePx });
    assert.equal(sim.sim.freeze, tt.hitStopMs);
    rec.quads = 0;
    sim.collect();
    assert.equal(rec.quads, 1, "one edge flash quad");
    sim.step(4);
    const cam = sim.camera();
    assert.equal(cam.scale, 1, "no push without cinematic");
    if (tt.shakePx === 0) assert.deepEqual([cam.ox, cam.oy], [0, 0]);
    else assert.ok(Math.hypot(cam.ox, cam.oy) <= tt.shakePx * Math.SQRT2);
  }
  sim.reset();
  sim.impulse({ at: MID, tier: 3, cinematic: true });
  sim.step(30);
  assert.ok(sim.camera().scale > 1.01);
  sim.reset();
  sim.impulse({ at: MID, tier: 2, cinematic: true });
  sim.step(30);
  assert.equal(sim.camera().scale, 1, "push is tier 3 only");
  // 顿帧冻住实例时钟，外部时钟照走
  sim.reset();
  sim.cast("holy", { from: HERO, targets: [MID], tier: 2 });
  sim.impulse({ at: MID, tier: 3 });
  sim.step(T.tiers[3].hitStopMs);
  assert.equal(sim.effects[0].realT, 0);
  sim.step(FRAME);
  assert.ok(Math.abs(sim.effects[0].realT - FRAME) < 1e-6);
});

test("edge flash stays within flashMaxLuma and about 1.2x the card", () => {
  const quads = [];
  const sim = E.createSim({ sink: { quad: (b, q) => quads.push(q), strip() {} } });
  sim.impulse({ at: MID, tier: 3 });
  sim.collect();
  const q = quads[0];
  assert.ok(q.col[3] <= T.flashMaxLuma - 1 + 1e-9, "added luminance ≤ flashMaxLuma − 1");
  assert.ok(Math.max(q.w, q.h) <= 1.2 * Math.max(MID.w, MID.h) + 1e-6);
  assert.equal(q.p0[0], E.MODES.EDGE);
});

test("contact budget is per axis (w and h separately) and scales with tier", () => {
  const sim = E.createSim({});
  for (const tier of [1, 2, 3]) {
    sim.reset();
    sim.cast("fireball", { from: HERO, targets: [MID], tier });
    const inst = sim.effects[0];
    const cs = T.tiers[tier].contactScale;
    const bw = T.contactBoxMax * MID.w * cs / 1.2;
    const bh = T.contactBoxMax * MID.h * cs / 1.2;
    assert.ok(Math.abs(inst.budgetW - bw) < 1e-9 && Math.abs(inst.budgetH - bh) < 1e-9);
    // 等比缩放后的自然外包（两轴取大）同时落在两轴预算里
    const e = inst.xf.k * inst.def.extent;
    assert.ok(e <= bw + 1e-9 && e <= bh + 1e-9, `extent ${e} vs ${bw}×${bh}`);
  }
  // 横卡：较紧的是高
  sim.reset();
  sim.cast("holy", { from: HERO, targets: [{ x: 800, y: 300, w: 200, h: 80 }], tier: 3 });
  assert.equal(sim.effects[0].budget, sim.effects[0].budgetH);
});

test("frost-field ground layer stays inside the union of targets + aoePad per axis", () => {
  const sim = E.createSim({});
  sim.cast("frost-field", { from: HERO, targets: ROW, aoe: true, tier: 3 });
  const g = sim.effects.find((e) => e.leader).ground;
  const x0 = Math.min(...ROW.map((b) => b.x - b.w / 2));
  const x1 = Math.max(...ROW.map((b) => b.x + b.w / 2));
  assert.ok(g.w <= x1 - x0 + 2 * T.aoePad && g.w >= x1 - x0, `ground w ${g.w}`);
  assert.ok(g.h <= 146 + 2 * T.aoePad && g.h >= 146, `ground h ${g.h}`);
  assert.equal(sim.effects.filter((e) => e.leader).length, 1);
});

test("bladeCross: blade body stops at the target card edge, X arms reach the per-axis budget", () => {
  const quads = [];
  const strips = [];
  const sim = E.createSim({ sink: { quad: (b, q) => quads.push(q), strip: (b, pts, p0) => strips.push({ pts, p0 }) } });
  sim.cast("bladeCross", { from: HERO, targets: [MID], tier: 3, seed: 3 });
  const inst = sim.effects[0];
  for (let t = 0; t < 400; t += FRAME) {
    sim.step(FRAME);
    strips.length = 0;
    sim.sim.debugLayer = "path";
    sim.collect();
    for (const s of strips) {
      if (s.p0[0] !== E.MODES.SOLID) continue;
      for (const p of s.pts) {
        const insideX = Math.abs(p.x - MID.x) < MID.w / 2 - 2;
        const insideY = Math.abs(p.y - MID.y) < MID.h / 2 - 2;
        assert.ok(!(insideX && insideY), `blade point ${p.x},${p.y} inside the card at ${t}`);
      }
    }
    if (inst.realT >= inst.hit + 160 && inst.realT < inst.hit + 200) {
      strips.length = 0;
      sim.sim.debugLayer = "contact";
      sim.collect();
      const arms = strips.filter((s) => s.p0[0] === E.MODES.SOLID);
      assert.equal(arms.length, 4);
      const tips = arms.map((s) => s.pts[1]);
      const maxX = Math.max(...tips.map((p) => Math.abs(p.x - MID.x)));
      const maxY = Math.max(...tips.map((p) => Math.abs(p.y - MID.y)));
      assert.ok(maxX <= inst.budgetW / 2 + 1e-6 && maxY <= inst.budgetH / 2 + 1e-6);
      assert.ok(maxX >= MID.w / 2 && maxY >= MID.h / 2, `arms reach the card corners: ${maxX}, ${maxY}`);
    }
    sim.sim.debugLayer = null;
  }
});
