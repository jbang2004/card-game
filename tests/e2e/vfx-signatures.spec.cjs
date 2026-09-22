/* Signature presentations, asserted through the director's trace and the one
 * effect backend (EmberFx2). V2 removed EmberVFX, the EmberFX canvas particles
 * and #fx-canvas, so nothing here reads a sprite atlas or a 2D canvas. */
const { test, expect } = require("@playwright/test");
const path = require("node:path");

async function demo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    EmberDebug.game.aiStep = () => ({ ok: true });
  });
}
async function play(page, id) {
  return page.evaluate((id) => {
    EmberFX.cancel(true);
    const g = EmberDebug.game;
    g.s.p.board = [];
    g.s.e.board = [];
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.active = "p";
    g.s.phase = "battle";
    g.s.e.hp = g.s.e.maxHp;
    g.s.e.armor = 0;
    g.s.e.secrets = [];
    for (let i = 0; i < 3; i++) g.summon("e", "treant");
    g.s.p.hand = [g.card(id)];
    g.events = [];
    g.emit();
    const c = EmberData.byId[id];
    const lastSeq = EmberFX.trace.at(-1)?.seq ?? 0;
    const spawned = { ...(EmberFx2.diagnostics?.spawned || {}) };
    Emberfall.act(() =>
      g.dispatch({
        type: "play",
        side: "p",
        uid: g.s.p.hand[0].uid,
        target: c.target ? { side: "e", uid: g.s.e.board[1].uid } : undefined,
      }),
    );
    return { lastSeq, spawned, state: JSON.stringify(g.s) };
  }, id);
}
const settled = (page) =>
  page.waitForFunction(
    () =>
      !EmberFX.busy &&
      !document.querySelector(".attack-actor,.death-ghost"),
  );
const recordsSince = (page, seq) =>
  page.evaluate((seq) => EmberFX.trace.filter((r) => r.seq > seq), seq);

for (const mobile of [false, true])
  test(`canonical spells and four legendary arrivals keep their own signature ${mobile ? "touch" : "desktop"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile ? { width: 390, height: 844 } : { width: 1600, height: 940 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await demo(page);
    // [card, trace type, expected kind]. V2: one pipeline on every platform,
    // so desktop and touch assert the same thing. Legendary battlecries only
    // draw when they have targets; their arrival is the summon record.
    for (const [id, type, kind] of [
      ["fireball", "cast", "fireball"],
      ["storm", "cast", "fireball"],
      ["nova", "cast", "frost-field"],
      ["execute", "cast", "bladeCross"],
      ["solaris", "summon", "solar-crown"],
      ["nyx", "summon", "astral-gate"],
      ["ashdragon", "summon", "dragon-wake"],
      ["frostking", "summon", "frost-throne"],
    ]) {
      const { lastSeq, state } = await play(page, id);
      await page.waitForFunction(
        ({ lastSeq, type, kind }) =>
          EmberFX.trace.some((r) => r.seq > lastSeq && r.type === type && r.kind === kind),
        { lastSeq, type, kind },
      );
      await page.waitForTimeout(160);
      await page.screenshot({
        path: path.resolve(
          `artifacts/qa/vfx-signatures/${id}-${mobile ? "touch" : "desktop"}.png`,
        ),
      });
      expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(state);
      await settled(page);
      const records = await recordsSince(page, lastSeq);
      expect(records.filter((r) => r.type === "warn"), id).toEqual([]);
      if (["solaris", "nyx", "ashdragon", "frostking"].includes(id)) {
        // The legendary arrival replaces the old arrival + battlecry double.
        expect(records.filter((r) => r.type === "summon" && r.kind === kind)).toHaveLength(1);
        await expect(page.locator(".summon-seal")).toHaveCount(0);
      }
    }
    expect(errors).toEqual([]);
    await context.close();
  });

test("attack families keep distinct contact language, ranged attackers never lunge", async ({
  page,
}) => {
  await demo(page);
  for (const [id, family, ranged] of [
    ["guard", "blade", false],
    ["wolf", "claw", false],
    ["titan", "slam", false],
    ["archer", "arrow", true],
    ["huntress", "spear", true],
    ["nyx", "bolt", true],
    ["dragon", "breath", true],
  ]) {
    const lastSeq = await page.evaluate((id) => {
      EmberFX.cancel(true);
      const g = EmberDebug.game;
      g.s.p.board = [];
      g.s.e.board = [];
      g.s.e.hp = g.s.e.maxHp;
      g.s.e.armor = 0;
      g.s.active = "p";
      g.s.phase = "battle";
      const a = g.summon("p", id, { sick: false });
      g.events = [];
      g.emit();
      const lastSeq = EmberFX.trace.at(-1)?.seq ?? 0;
      Emberfall.act(() =>
        g.dispatch({
          type: "attack",
          side: "p",
          uid: a.uid,
          target: { side: "e", uid: "hero" },
        }),
      );
      return lastSeq;
    }, id);
    await page.waitForFunction(
      (lastSeq) => EmberFX.trace.some((r) => r.seq > lastSeq && r.type === "attack"),
      lastSeq,
    );
    if (ranged) expect(await page.locator(".attack-actor").count()).toBe(0);
    else expect(await page.evaluate(() => EmberFx2.mesh3d.last?.sourceCid)).toBe(id);
    await page.waitForTimeout(ranged ? 100 : 60);
    await page.screenshot({
      path: path.resolve(`artifacts/qa/vfx-signatures/attack-${id}.png`),
    });
    await settled(page);
    const attack = (await recordsSince(page, lastSeq)).find((r) => r.type === "attack");
    expect(attack.kind, id).toBe(family);
    expect(attack.ranged, id).toBe(ranged);
    expect(attack.numberAt[0], id).not.toBeNull();
    expect(Math.abs(attack.numberAt[0] - attack.hitAt[0]), id).toBeLessThanOrEqual(45);
  }
});

test("a compressed sequence scales contact, hit-stop and mesh motion with one clock", async ({
  page,
}) => {
  await demo(page);
  const report = await page.evaluate(async () => {
    EmberFX.cancel(true);
    const g = EmberDebug.game;
    g.s.active = "p";
    g.s.phase = "battle";
    g.s.p.board = [];
    g.s.e.board = [];
    const a = g.summon("p", "guard", { sick: false });
    const t = g.summon("e", "treant", { sick: false });
    g.events = [];
    g.emit();
    const original = EmberFX.present;
    // 30 observations the player never sees force the 6500ms compression.
    EmberFX.present = (events, ...rest) => {
      EmberFX.present = original;
      const burn = Array.from({ length: 30 }, (_, i) => ({
        id: "pad-" + i,
        type: "burn",
        parentId: null,
        side: "e",
      }));
      return original([...burn, ...events], ...rest);
    };
    const lastSeq = EmberFX.trace.at(-1)?.seq ?? 0;
    Emberfall.act(() =>
      g.dispatch({ type: "attack", side: "p", uid: a.uid, target: { side: "e", uid: t.uid } }),
    );
    let actor = null;
    await new Promise((resolve) => {
      const f = () => {
        actor ||= document.querySelector(".attack-actor");
        EmberFX.busy ? setTimeout(f, 10) : resolve();
      };
      f();
    });
    const attack = EmberFX.trace.find((r) => r.seq > lastSeq && r.type === "attack");
    return {
      contactMs: attack.motion.contact,
      releaseMs: attack.motion.release,
      motionEndMs: attack.motion.duration,
      numberDelta: Math.abs(attack.numberAt[0] - attack.hitAt[0]),
    };
  });
  // Uncompressed: contact 260, recovery ends 460. Compressed: both shrink by
  // the same factor, and the number still lands on the scaled contact.
  const scale = report.contactMs / 260;
  expect(scale).toBeLessThan(1);
  // Recovery (200) and the tier hit-stop (0 / 50 / 90) shrink by the same scale.
  expect((report.motionEndMs - report.releaseMs) / scale).toBeCloseTo(200, 0);
  expect(
    [0, 50, 90].some((ms) => Math.abs((report.releaseMs - report.contactMs) / scale - ms) < 1),
  ).toBe(true);
  expect(report.numberDelta).toBeLessThanOrEqual(45);
});

test("countered major spell casts nothing and resize drops every queued presentation", async ({
  page,
}) => {
  await demo(page);
  const result = await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.mana = 10;
    g.s.e.secrets = ["counterspell"];
    g.s.p.hand = [g.card("fireball")];
    g.events = [];
    g.emit();
    const lastSeq = EmberFX.trace.at(-1)?.seq ?? 0,
      spawned = EmberFx2.diagnostics?.spawned?.fireball || 0,
      hp = g.s.e.hp;
    Emberfall.act(() =>
      g.dispatch({
        type: "play",
        side: "p",
        uid: g.s.p.hand[0].uid,
        target: { side: "e", uid: "hero" },
      }),
    );
    return { lastSeq, spawned, hp };
  });
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => EmberDebug.game.s.e.hp)).toBe(result.hp);
  expect(
    await page.evaluate(() => EmberFx2.diagnostics?.spawned?.fireball || 0),
  ).toBe(result.spawned);
  const records = await recordsSince(page, result.lastSeq);
  const cast = records.find((r) => r.type === "cast");
  expect(cast.countered).toBe(true);
  expect(cast.targets).toEqual([]);
  expect(records.find((r) => r.type === "secret").kind).toBe("counterspell");
  const { state } = await play(page, "storm");
  await page.waitForTimeout(250);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => [EmberFX.busy, EmberFX.pendingTimers, EmberFX.transientNodes]),
  ).toEqual([false, 0, 0]);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(state);
});

test("without WebGL the same director keeps DOM motion and numbers; reduced motion halves it", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /webgl/.test(type) ? null : getContext.call(this, type, ...args);
    };
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await demo(page);
  expect(await page.evaluate(() => EmberFx2.available)).toBe(false);
  const { lastSeq, state } = await play(page, "fireball");
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(state);
  const cast = (await recordsSince(page, lastSeq)).find((r) => r.type === "cast");
  expect(cast.kind).toBe("fireball");
  expect(Math.abs(cast.numberAt[0] - cast.hitAt[0])).toBeLessThanOrEqual(45);
  expect(await page.evaluate(() => EmberFx2.diagnostics.spawned.fireball || 0)).toBe(0);
  expect(errors).toEqual([]);
  await context.close();

  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const p = await reduced.newPage();
  await demo(p);
  await p.evaluate(() => EmberFX.configure(true, false));
  const before = await p.evaluate(() => ({ ...(EmberFx2.diagnostics?.spawned || {}) }));
  const first = await play(p, "ashdragon");
  await p.waitForFunction(() => !EmberFX.busy);
  const records = await recordsSince(p, first.lastSeq);
  expect(records.some((r) => r.type === "summon")).toBe(true);
  expect(await p.evaluate(() => ({ ...(EmberFx2.diagnostics?.spawned || {}) }))).toEqual(before);
  await reduced.close();
});
