const { test, expect } = require("@playwright/test");
const path = require("node:path");
async function demo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => EmberVFX.prepare());
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
    const before = { ...EmberVFX.diagnostics.spawned };
    Emberfall.act(() =>
      g.dispatch({
        type: "play",
        side: "p",
        uid: g.s.p.hand[0].uid,
        target: c.target ? { side: "e", uid: g.s.e.board[1].uid } : undefined,
      }),
    );
    return { before, state: JSON.stringify(g.s) };
  }, id);
}
for (const mobile of [false, true])
  test(`canonical spells and four legendary arrivals use distinct real-event effects ${mobile ? "touch" : "desktop"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1600, height: 940 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await demo(page);
    for (const [id, kind] of [
      ["fireball", "comet"],
      ["storm", "comet"],
      ["nova", "frost-field"],
      ["execute", "void"],
      ["solaris", "solar-crown"],
      ["nyx", "astral-gate"],
      ["ashdragon", "dragon-wake"],
      ["frostking", "frost-throne"],
    ]) {
      const { before, state } = await play(page, id);
      await page.waitForFunction(
        ({ kind, count }) => (EmberVFX.diagnostics.spawned[kind] || 0) > count,
        { kind, count: before[kind] || 0 },
      );
      await page.waitForTimeout(kind === "comet" ? 250 : 120);
      await page.screenshot({
        path: path.resolve(
          `artifacts/qa/vfx-signatures/${id}-${mobile ? "touch" : "desktop"}.png`,
        ),
      });
      if (["solaris", "nyx", "ashdragon", "frostking"].includes(id)) {
        const statAlpha = await page.evaluate((id) => {
          const el = document.querySelector(
            `.minion.friendly[data-cardid="${id}"] .stat.hp`,
          );
          const p = EmberFX.pos(el),
            canvas = document.getElementById("fx-canvas"),
            scale = canvas.width / EmberViewport.width;
          return canvas
            .getContext("2d")
            .getImageData(
              Math.floor(p.x * scale),
              Math.floor(p.y * scale),
              1,
              1,
            ).data[3];
        }, id);
        expect(statAlpha).toBe(0);
      }
      expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
        state,
      );
      await page.waitForFunction(
        () => !EmberFX.busy && EmberFX.particles === 0,
      );
      expect(await page.locator(".signature-cue").count()).toBe(0);
    }
    const metrics = await page.evaluate(() => EmberVFX.diagnostics);
    expect(metrics.loaded).toHaveLength(13);
    expect(metrics.failed).toEqual([]);
    expect(metrics.peak).toBeLessThanOrEqual(mobile ? 48 : 96);
    expect(metrics.decodedBytes).toBeLessThanOrEqual(24 * 1024 * 1024);
    expect(errors).toEqual([]);
    await test.info().attach(`vfx-${mobile ? "touch" : "desktop"}-metrics`, {
      body: JSON.stringify(metrics, null, 2),
      contentType: "application/json",
    });
    await context.close();
  });
test("weapons distinguish contact slashes, claws, slam and ranged trajectories", async ({
  page,
}) => {
  await demo(page);
  for (const [id, kind, ranged] of [
    ["guard", "sprite", false],
    ["wolf", "sprite", false],
    ["titan", "fracture", false],
    ["archer", "arrow", true],
    ["huntress", "arrow", true],
    ["nyx", "bolt", true],
    ["dragon", "beam", true],
  ]) {
    const before = await page.evaluate((id) => {
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
      const counts = { ...EmberVFX.diagnostics.spawned };
      Emberfall.act(() =>
        g.dispatch({
          type: "attack",
          side: "p",
          uid: a.uid,
          target: { side: "e", uid: "hero" },
        }),
      );
      return counts;
    }, id);
    await page.waitForFunction(
      ({ kind, count }) => (EmberVFX.diagnostics.spawned[kind] || 0) > count,
      { kind, count: before[kind] || 0 },
    );
    if (ranged) expect(await page.locator(".attack-actor").count()).toBe(0);
    await page.waitForTimeout(ranged ? 100 : 45);
    await page.screenshot({
      path: path.resolve(`artifacts/qa/vfx-signatures/attack-${id}.png`),
    });
    await page.waitForFunction(() => !EmberFX.busy && EmberFX.particles === 0);
  }
});
test("countered major spell has no target meteor or damage, and resize drops every queued VFX", async ({
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
    const before = { ...EmberVFX.diagnostics.spawned },
      hp = g.s.e.hp;
    Emberfall.act(() =>
      g.dispatch({
        type: "play",
        side: "p",
        uid: g.s.p.hand[0].uid,
        target: { side: "e", uid: "hero" },
      }),
    );
    return { before, hp };
  });
  await page.waitForFunction(() => !EmberFX.busy && EmberFX.particles === 0);
  expect(await page.evaluate(() => EmberDebug.game.s.e.hp)).toBe(result.hp);
  expect(
    await page.evaluate(() => EmberVFX.diagnostics.spawned.comet || 0),
  ).toBe(result.before.comet || 0);
  const { state } = await play(page, "storm");
  await page.waitForTimeout(250);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => [
      EmberVFX.active,
      EmberFX.pendingTimers,
      EmberFX.transientNodes,
    ]),
  ).toEqual([0, 0, 0]);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    state,
  );
});
test("failed atlas keeps the fallback playable, while reduced motion skips all VFX decoding", async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const column = require("../../assets/vfx/manifest.json").assets.find(
    (a) => a.id === "storm-column",
  );
  await page.route(`**/assets/${column.sha256.slice(0, 20)}.webp`, (r) =>
    r.abort(),
  );
  await demo(page);
  expect(await page.evaluate(() => EmberVFX.diagnostics.failed)).toContain(
    "storm-column",
  );
  const fallback = await page.evaluate(() => {
    EmberFX.cancel(true);
    const p = { x: 500, y: 400 };
    const result = {
      fire: EmberVFX.hit(p, "fire"),
      holy: EmberVFX.hit(p, "holy"),
      blade: EmberVFX.hit(p, "steel", 1, "blade"),
      nature: EmberVFX.hit(p, "nature"),
    };
    EmberFX.cancel(true);
    EmberFX.impact(500, 400, "holy");
    result.legacyParticles = EmberFX.particles;
    result.newParticles = EmberVFX.active;
    EmberFX.cancel(true);
    return result;
  });
  expect(fallback).toMatchObject({
    fire: true,
    holy: false,
    blade: true,
    nature: true,
    newParticles: 0,
  });
  expect(fallback.legacyParticles).toBeGreaterThan(0);
  const { state } = await play(page, "fireball");
  await page.waitForFunction(() => !EmberFX.busy && EmberFX.particles === 0);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    state,
  );
  await context.close();
  const reduced = await browser.newContext({ reducedMotion: "reduce" });
  const p = await reduced.newPage();
  await demo(p);
  await play(p, "ashdragon");
  await p.waitForFunction(() => !EmberFX.busy);
  expect(
    await p.evaluate(() => [
      EmberVFX.active,
      EmberVFX.diagnostics.loaded.length,
    ]),
  ).toEqual([0, 0]);
  await reduced.close();
});
