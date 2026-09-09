const { assertDialogFit } = require("./helpers/dialog-pages.cjs");
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
test("VFX lab previews real signatures without changing the game, supports keyboard replay and exits cleanly", async ({
  page,
}) => {
  await demo(page);
  const state = await page.evaluate(() => JSON.stringify(EmberDebug.game.s));
  await page.evaluate(() => Emberfall.showFXLab());
  await assertDialogFit(page);
  await page.locator(".folio-lab-school").selectOption("frost");
  await page.locator("#lab-replay").click();
  await page.waitForTimeout(400);
  await page.waitForFunction(() => !EmberFX.busy);
  await page.locator("#lab-variant").selectOption("ashdragon");
  await page.waitForFunction(
    () => (EmberVFX.diagnostics.spawned["dragon-wake"] || 0) > 0,
  );
  await page.waitForFunction(() => !EmberFX.busy);
  await page.locator("#lab-variant").selectOption("frostking");
  await page.waitForFunction(
    () => (EmberVFX.diagnostics.spawned["frost-throne"] || 0) > 0,
  );
  await page.waitForTimeout(90);
  const ink = await page.evaluate(() => {
    const canvas = document.getElementById("fx-canvas"),
      bounds = EmberFX.pos(document.querySelector(".lab-stage"));
    const pixels = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height).data;
    const scale = canvas.width / EmberViewport.width;
    let total = 0,
      outside = 0;
    for (let y = 0; y < canvas.height; y += 2)
      for (let x = 0; x < canvas.width; x += 2) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 8) continue;
        total++;
        if (
          x < bounds.left * scale - 2 ||
          x > (bounds.left + bounds.w) * scale + 2 ||
          y < bounds.top * scale - 2 ||
          y > (bounds.top + bounds.h) * scale + 2
        )
          outside++;
      }
    return { total, outside };
  });
  expect(ink.total).toBeGreaterThan(0);
  expect(ink.outside).toBe(0);
  await expect(page.locator("#lab-replay")).toBeEnabled();
  await page.locator("#lab-replay").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => (EmberVFX.diagnostics.spawned["frost-throne"] || 0) > 1,
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => Emberfall.modal !== "lab");
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    state,
  );
  expect(
    await page.evaluate(() => [EmberVFX.active, EmberFX.pendingTimers]),
  ).toEqual([0, 0]);
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

test("the lab stage and playback controls fit both phone orientations", async ({
  browser,
}) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await demo(page);
    await page.evaluate(() => Emberfall.showFXLab());
    await assertDialogFit(page);
    await page.locator(".folio-lab-school").selectOption("frost");
    await page.locator("#lab-replay").click();
    for (const selector of [
      "#lab-variant",
      "#lab-replay",
      ".lab-stage",
      ".lab-box .modal-close",
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
    const stage = await page.locator(".lab-stage").boundingBox(),
      footer = await page.locator(".lab-footer").boundingBox();
    expect(
      stage.y + stage.height <= footer.y + 1 ||
        stage.x + stage.width <= footer.x + 1 ||
        footer.x + footer.width <= stage.x + 1,
    ).toBe(true);
    await page.screenshot({
      path: path.resolve(
        `artifacts/qa/vfx-signatures/lab-controls-${viewport.width}.png`,
      ),
    });
    await context.close();
  }
});
