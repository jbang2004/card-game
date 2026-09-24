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
  expect(await page.evaluate(() => EmberMiniatures.diagnostics().figures)).toBe(2);
  await page.evaluate(() => Emberfall.home());
  await page.waitForFunction(() => !Emberfall.inBattle);
  expect(errors).toEqual([]);
});
