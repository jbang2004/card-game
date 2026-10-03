const { test, expect } = require("@playwright/test");
// Desktop: both heroes stand as figures on their daises behind their sides, off the court's planks (EmberMiniatures
// on the seats EmberArena3D raises where EmberBattleView stands them) — seen over our right shoulder, the player's
// low on the left, the enemy's high on the right. The plates stay the click targets, follow the effect layer's cues
// and never change the rules state.
test("heroes stand on their daises and answer power, damage and victory", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.startGame("ranger", 0));
  await page.locator("#modal button", { hasText: "开始" }).click();
  await page.waitForFunction(() => Emberfall.inBattle && !Emberfall.modal && !EmberFX.busy);
  await page.waitForFunction(() => EmberMiniatures.hero("p") && EmberMiniatures.hero("e"), null, { timeout: 60000 });
  await expect(page.locator("#player-hero")).toHaveClass(/hero-dais/);
  await expect(page.locator("#enemy-hero")).toHaveClass(/hero-dais/);
  expect(await page.evaluate(() => EmberHeroFigure.diagnostics().status)).toBe("ready");
  // the stations: the player's low on the left, the enemy's high on the right, each dais beyond its end of the court
  const layout = await page.evaluate(() => {
    const seat = (s) => EmberArena3D.seat(s), W = EmberViewport.width, H = EmberViewport.height;
    const z = (s) => Math.abs(EmberBattleView.hero(s)[2]) * EmberBattleView.K;
    return { p: seat("p"), e: seat("e"), W, H, hz: EmberArena3D.board.hz, pz: z("p"), ez: z("e") };
  });
  expect(layout.p.x).toBeLessThan(layout.W * 0.2);
  expect(layout.p.y).toBeGreaterThan(layout.H * 0.55);
  expect(layout.e.x).toBeGreaterThan(layout.W * 0.8);
  expect(layout.e.y).toBeLessThan(layout.H * 0.4);
  expect(layout.pz).toBeGreaterThan(layout.hz);
  expect(layout.ez).toBeGreaterThan(layout.hz);
  // the plates keep input: clicking the enemy's station still reaches the enemy hero
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("enemy-hero")).pointerEvents)).not.toBe("none");
  await page.evaluate(() => { const g = EmberDebug.game; g.s.p.mana = 10; Emberfall.renderNow(); Emberfall.usePower(); });
  await page.waitForFunction(() => EmberHeroFigure.diagnostics().cues.some((c) => c.kind === "shot"));
  await page.waitForFunction(() => EmberMiniatures.diagnostics().cues.some((c) => c.key === "p:hero" && c.kind === "cast"));
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => EmberDebug.game.s.e.hp)).toBe(28);
  await page.waitForFunction(() => EmberMiniatures.diagnostics().cues.some((c) => c.key === "e:hero" && c.kind === "hurt"));
  await page.evaluate(() => {
    const g = EmberDebug.game; g.s.active = "e";
    const m = g.summon("e", "wolf"); m.sick = false; Emberfall.renderNow();
    Emberfall.act(() => g.dispatch({ type: "attack", side: "e", uid: m.uid, target: { side: "p", uid: "hero" } }));
  });
  await page.waitForFunction(() => EmberMiniatures.diagnostics().cues.some((c) => c.key === "p:hero" && c.kind === "hurt"));
  await page.evaluate(() => Emberfall.home());
  await page.waitForFunction(() => !Emberfall.inBattle);
  expect(errors).toEqual([]);
});
