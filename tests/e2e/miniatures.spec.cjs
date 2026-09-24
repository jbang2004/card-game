const { test, expect } = require("@playwright/test");
// Minion miniatures: one stage canvas; figures stand on tokens that have a spec,
// answer attack / hurt / death cues and never change the rules state.
test("minion miniatures follow tokens and combat cues", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.startGame("ranger", 0));
  await page.locator("#modal button", { hasText: "开始" }).click();
  await page.waitForFunction(() => Emberfall.inBattle && !Emberfall.modal && !EmberFX.busy);
  const ids = await page.evaluate(() => {
    const g = EmberDebug.game;
    const h = g.summon("p", "huntress"), d = g.summon("p", "duskstag"), w = g.summon("e", "wolf");
    g.summon("p", "squire"); // no spec: stays a flat token
    Emberfall.renderNow();
    return { h: h.uid, d: d.uid, w: w.uid };
  });
  await page.waitForFunction(() => EmberMiniatures.diagnostics().figures === 3);
  expect(await page.locator("#miniature-stage").count()).toBe(1);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("miniature-stage")).pointerEvents)).toBe("none");
  await expect(page.locator(`#minions .minion[data-uid="${ids.h}"]`)).toHaveClass(/miniature-ready/);
  await expect(page.locator('#minions .minion[data-cardid="squire"]')).not.toHaveClass(/miniature-ready/);
  const before = await page.evaluate(() => JSON.stringify(EmberDebug.game.s.e.board.map((m) => [m.uid, m.hp])));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s.e.board.map((m) => [m.uid, m.hp])))).toBe(before);
  await page.evaluate(({ h, w }) => Emberfall.act(() => EmberDebug.game.dispatch({ type: "attack", side: "p", uid: h, target: { side: "e", uid: w } })), ids);
  await page.waitForFunction(() => { const c = EmberMiniatures.diagnostics().cues.map((x) => x.kind); return c.includes("attack") && c.includes("death"); });
  await page.waitForFunction(() => !EmberFX.busy);
  await page.waitForFunction(() => EmberMiniatures.diagnostics().dying === 0);
  // the wolf is gone; whatever its deathrattle leaves behind (a pup) stands as its own figure
  const left = await page.evaluate(() => ({
    expected: [...document.querySelectorAll("#minions .minion[data-cardid]")].filter((el) => EmberVoxelKit.forCard(el.dataset.cardid)).length,
    figures: EmberMiniatures.diagnostics().figures,
  }));
  expect(left.figures).toBe(left.expected);
  expect(left.expected).toBeGreaterThanOrEqual(2);
  await page.evaluate(() => Emberfall.home());
  await page.waitForFunction(() => !Emberfall.inBattle);
  expect(errors).toEqual([]);
});

// A played card turns straight into its figure: the token lands already dimmed to a backdrop (its flat art never
// shows) and the figure, baked ahead from the hand, assembles on it within the same sequence.
test("a played card becomes its figure without a flat token", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.evaluate(() => {
    EmberFX.cancel(true);
    const g = EmberDebug.game;
    g.s.active = "p"; g.s.phase = "battle";
    g.s.p.mana = g.s.p.maxMana = 10; g.s.p.board = []; g.s.e.board = [];
    g.s.p.hand = [g.card("reaper")];
    g.events = []; g.emit();
  });
  const spec = await page.evaluate(() => EmberVoxelKit.forCard("reaper").id);
  await page.waitForFunction((id) => !!EmberVoxelRender.cached(id), spec);       // prewarmed from the hand
  const seen = await page.evaluate(async () => {
    const g = EmberDebug.game, live0 = EmberMiniatures.diagnostics().live, t0 = performance.now();
    Emberfall.act(() => g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }));
    let landed = null, flat = 0, liveAt = null;
    await new Promise((done) => {
      const tick = () => {
        const t = performance.now() - t0, tok = document.querySelector('#minions .minion[data-cardid="reaper"]');
        if (tok && getComputedStyle(tok).visibility !== "hidden") {
          landed ??= t;
          if (parseFloat(getComputedStyle(tok.querySelector(".minion-art img")).opacity) > 0.5) flat++;
          if (liveAt == null && EmberMiniatures.diagnostics().live > live0) liveAt = t;
        }
        if (liveAt != null || t > 4000) return done();
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return { landed, flat, liveAt };
  });
  expect(seen.landed).not.toBeNull();
  expect(seen.flat).toBe(0);
  expect(seen.liveAt).not.toBeNull();
  expect(seen.liveAt - seen.landed).toBeLessThan(1500);
  await expect(page.locator('#minions .minion[data-cardid="reaper"]')).toHaveClass(/miniature-ready/);
  expect(errors).toEqual([]);
});

// A narrow desktop window (mouse, compact battle layout) keeps its figures, sized to its tokens; only touch phones
// go without them for now.
test("a narrow desktop window keeps its figures", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.startGame("ranger", 0));
  await page.locator("#modal button", { hasText: "开始" }).click();
  await page.waitForFunction(() => Emberfall.inBattle && !Emberfall.modal && !EmberFX.busy);
  expect(await page.evaluate(() => EmberViewport.mobile)).toBe(true);
  await page.evaluate(() => { EmberDebug.game.summon("p", "reaper"); EmberDebug.game.summon("e", "wolf"); Emberfall.renderNow(); });
  await page.waitForFunction(() => EmberMiniatures.diagnostics().live === 2);
  await expect(page.locator('#minions .minion[data-cardid="reaper"]')).toHaveClass(/miniature-ready/);
});
