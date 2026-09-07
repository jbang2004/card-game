const { test, expect } = require("@playwright/test");
const path = require("node:path");

async function demo(page) {
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").click();
  await page.waitForFunction(() => !EmberFX.busy);
}
async function legend(page) {
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.mana = g.s.p.maxMana = 10;
    g.s.p.hand = [g.card("solaris")];
    g.emit();
  });
  await page.locator('#hand [data-cardid="solaris"]').click();
}
for (const mobile of [false, true]) {
  test(`combat cues and bounded cleanup ${mobile ? "touch" : "desktop"}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1600, height: 940 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await demo(page);
    // Invoke the same public application action on touch, where selection requires confirmation.
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.mana = g.s.p.maxMana = 10;
      g.s.p.hand = [g.card("solaris")];
      g.emit();
      Emberfall.act(() =>
        g.dispatch({ type: "play", side: "p", uid: g.s.p.hand[0].uid }),
      );
    });
    await expect(page.locator(".summon-seal")).toBeVisible();
    await page.waitForTimeout(160);
    await page.screenshot({
      path: path.resolve(
        `artifacts/qa/legend-${mobile ? "touch" : "desktop"}.png`,
      ),
    });
    const settled = await page.evaluate(() =>
      JSON.stringify(EmberDebug.game.s),
    );
    await page.waitForFunction(
      () =>
        !EmberFX.busy &&
        EmberFX.pendingTimers === 0 &&
        EmberFX.activeAnimations === 0 &&
        EmberFX.transientNodes === 0 &&
        EmberFX.particles === 0,
    );
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      settled,
    );
    // The cue itself consumes only a snapshot and cannot advance the turn or RNG.
    await page.evaluate(() =>
      EmberFX.present(
        [{ type: "turn", side: "p" }],
        Emberfall.game.s,
        () => {},
        () => {},
      ),
    );
    await expect(page.locator(".turn-cue")).toContainText("你的回合");
    expect(
      await page
        .locator(".turn-cue")
        .evaluate((el) => getComputedStyle(el).pointerEvents),
    ).toBe("none");
    await page.waitForTimeout(220);
    await page.screenshot({
      path: path.resolve(
        `artifacts/qa/turn-${mobile ? "touch" : "desktop"}.png`,
      ),
    });
    expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
      settled,
    );
    await page.evaluate(() => EmberFX.cancel());
    expect(
      await page.evaluate(() => [
        EmberFX.busy,
        EmberFX.pendingTimers,
        EmberFX.activeAnimations,
        EmberFX.transientNodes,
        EmberFX.particles,
      ]),
    ).toEqual([false, 0, 0, 0, 0]);
    expect(errors).toEqual([]);
    await context.close();
  });
}

test("reduced motion during cast preserves the single commit and removes decoration", async ({
  page,
}) => {
  await demo(page);
  await legend(page);
  const authoritative = await page.evaluate(() =>
    JSON.stringify(EmberDebug.game.s),
  );
  await page.evaluate(() => EmberFX.configure(true, true));
  await page.waitForFunction(
    () => !EmberFX.busy && EmberFX.pendingTimers === 0,
  );
  await expect(page.locator('.friendly[data-cardid="solaris"]')).toHaveCount(1);
  expect(await page.evaluate(() => JSON.stringify(EmberDebug.game.s))).toBe(
    authoritative,
  );
  expect(
    await page.evaluate(() => [
      EmberFX.activeAnimations,
      EmberFX.particles,
      EmberFX.transientNodes,
    ]),
  ).toEqual([0, 0, 0]);
  await page.evaluate(() => {
    EmberFX.configure(false, true);
    for (let i = 0; i < 15; i++) EmberFX.impact(500, 400, "fire", 2);
  });
  expect(await page.evaluate(() => EmberFX.particles)).toBeLessThanOrEqual(220);
  await page.evaluate(() => EmberFX.reflow());
  expect(
    await page.evaluate(() => [
      EmberFX.busy,
      EmberFX.pendingTimers,
      EmberFX.activeAnimations,
      EmberFX.transientNodes,
      EmberFX.particles,
    ]),
  ).toEqual([false, 0, 0, 0, 0]);
});
