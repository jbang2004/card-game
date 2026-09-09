const { test, expect } = require("@playwright/test");

test("short landscape dialogs keep actual play and return actions reachable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 568, height: 320 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  await page.locator("#quick-btn").tap();
  await page.waitForFunction(() => !EmberFX.busy);
  await page.locator('#hand [data-cardid="frostbolt"]').tap();
  await expect(page.locator("#toast")).not.toBeVisible();
  // Tap screen coordinates so Playwright cannot silently scroll a hidden footer into view.
  const tapVisibleCenter = async (selector) => {
    const point = await page.locator(selector).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2,
        y = r.y + r.height / 2;
      return {
        x,
        y,
        visible:
          r.top >= 0 &&
          r.bottom <= innerHeight &&
          el.contains(document.elementFromPoint(x, y)),
      };
    });
    expect(point.visible).toBe(true);
    await page.touchscreen.tap(point.x, point.y);
  };
  await page.screenshot({ path: "artifacts/qa/dialog-short-touch-card.png" });
  await tapVisibleCenter("#touch-card-play");
  await expect(page.locator("#touch-card-play")).toHaveCount(0);
  await page.locator('.enemy[data-cardid="golem"]').tap();
  await page.waitForFunction(() => !EmberFX.busy);
  await expect(page.locator('.enemy[data-cardid="golem"]')).toHaveClass(
    /frozen/,
  );
  expect(await page.evaluate(() => EmberDebug.game.s.p.mana)).toBe(4);
  await page.evaluate(() => {
    const g = EmberDebug.game;
    g.s.p.hp = 0;
    g.cleanup();
    g.emit();
  });
  await expect(page.locator("#result-home")).toBeVisible();
  await page.screenshot({ path: "artifacts/qa/dialog-short-loss.png" });
  await tapVisibleCenter("#result-home");
  await expect(page.locator("#start-btn")).toBeVisible();
  await expect(page.locator("#result-home")).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});
