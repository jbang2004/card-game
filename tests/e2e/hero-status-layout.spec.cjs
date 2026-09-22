const { test, expect } = require("@playwright/test");
const path = require("node:path");
test("frozen heroes keep their status on the portrait across layouts", async ({
  browser,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 844, height: 390 },
    { width: 1920, height: 1080 },
  ]) {
    const context = await browser.newContext({
        viewport,
        isMobile: viewport.width < 1000,
        hasTouch: viewport.width < 1000,
      }),
      page = await context.newPage();
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    await page.locator("#quick-btn").click();
    await page.waitForFunction(() => !EmberFX.busy);
    await page.evaluate(() => {
      const g = EmberDebug.game;
      g.s.p.frozen = g.s.e.frozen = true;
      g.s.p.weapon = { cid: "sunblade", atk: 4, durability: 2, tags: [] };
      g.events = [];
      g.emit();
      Emberfall.clearSelection();
    });
    const statuses = await page
      .locator("#battle .hero")
      .evaluateAll((heroes) =>
        heroes.map((hero) => ({
          outer: getComputedStyle(hero, "::after").display,
          inner: getComputedStyle(
            hero.querySelector(".portrait-frame"),
            "::after",
          ).content,
          label: hero.getAttribute("aria-label"),
        })),
      );
    for (const status of statuses) {
      expect(status.outer).toBe("none");
      expect(status.inner).toContain("❄");
      expect(status.label).toContain("已冻结");
    }
    await page.screenshot({
      path: path.resolve(
        `artifacts/battle-layout-audit-20260919/${viewport.width}x${viewport.height}-frozen.png`,
      ),
    });
    await context.close();
  }
});
