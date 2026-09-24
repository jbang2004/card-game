const { test, expect } = require("@playwright/test");
// The ranger hero's voxel figure stands in the player hero plate's portrait window, follows the
// effect layer's cues and never changes the rules state.
test("ranger voxel figure appears on the hero plate and answers power and damage", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.evaluate(() => Emberfall.startGame("ranger", 0));
  await page.locator("#modal button", { hasText: "开始" }).click();
  await page.waitForFunction(() => Emberfall.inBattle && !Emberfall.modal && !EmberFX.busy);
  await page.waitForFunction(() => EmberHeroFigure.diagnostics().status === "ready");
  // the hero's fixed seat: exactly its portrait window, never over the board or the plate's chips
  const box = await page.locator("#hero-figure").boundingBox();
  const win = await page.locator("#player-hero .portrait-frame").boundingBox();
  for (const k of ["x", "y", "width", "height"]) expect(Math.abs(box[k] - win[k])).toBeLessThan(2);
  await expect(page.locator("#player-hero")).toHaveClass(/hero-miniature-ready/);
  // the overlay never takes input: clicking the plate still reaches the hero
  expect(await page.evaluate(() => getComputedStyle(document.getElementById("hero-figure")).pointerEvents)).toBe("none");
  await page.evaluate(() => { const g = EmberDebug.game; g.s.p.mana = 10; Emberfall.renderNow(); Emberfall.usePower(); });
  await page.waitForFunction(() => EmberHeroFigure.diagnostics().cues.some((c) => c.kind === "shot"));
  await page.waitForFunction(() => !EmberFX.busy);
  expect(await page.evaluate(() => EmberDebug.game.s.e.hp)).toBe(28);
  await page.evaluate(() => {
    const g = EmberDebug.game; g.s.active = "e";
    const m = g.summon("e", "wolf"); m.sick = false; Emberfall.renderNow();
    Emberfall.act(() => g.dispatch({ type: "attack", side: "e", uid: m.uid, target: { side: "p", uid: "hero" } }));
  });
  await page.waitForFunction(() => EmberHeroFigure.diagnostics().cues.some((c) => c.kind === "hurt"));
  await page.evaluate(() => Emberfall.home());
  await page.waitForFunction(() => !Emberfall.inBattle);
  expect(errors).toEqual([]);
});
