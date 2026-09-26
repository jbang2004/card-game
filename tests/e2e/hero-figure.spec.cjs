const { test, expect } = require("@playwright/test");
// Desktop: both heroes stand as figures on their daises outside the court (EmberMiniatures on the seats
// EmberArena3D raises) — the player's in the bottom-left corner, the enemy's in the top-right. The plates
// stay the click targets, follow the effect layer's cues and never change the rules state.
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
  // the stations: the player's in the bottom-left quarter, the enemy's in the top-right, each dais outside the court
  const layout = await page.evaluate(() => {
    const court = EmberArena3D.board.court, seat = (s) => EmberArena3D.seat(s), W = EmberViewport.width, H = EmberViewport.height;
    return { court, p: seat("p"), e: seat("e"), W, H };
  });
  expect(layout.p.x).toBeLessThan(layout.W * 0.2);
  expect(layout.p.y).toBeGreaterThan(layout.H * 0.7);
  expect(layout.e.x).toBeGreaterThan(layout.W * 0.8);
  expect(layout.e.y).toBeLessThan(layout.H * 0.4);
  expect(layout.p.x + layout.p.rx).toBeLessThan(layout.court[0] + 40);
  expect(layout.e.x - layout.e.rx).toBeGreaterThan(layout.court[2] - 40);
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
