const { test, expect } = require("@playwright/test");
const { openDeckTools } = require("./helpers/deck-tools.cjs");
for (const [width, height] of [
  [1600, 940],
  [390, 844],
  [844, 390],
  [568, 320],
]) {
  test(`polished entry, fixed actions and independent battle controls ${width}x${height}`, async ({
    browser,
  }) => {
    const ctx = await browser.newContext({
      viewport: { width, height },
      isMobile: width < 1000,
      hasTouch: width < 1000,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("./?debug=1");
    await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
    const visibleInViewport = async (selector) => {
      const r = await page.locator(selector).boundingBox();
      expect(r).toBeTruthy();
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.height).toBeLessThanOrEqual(height + 1);
      expect(r.x + r.width).toBeLessThanOrEqual(width + 1);
    };
    for (const selector of ["#start-btn", "#quick-btn"])
      await visibleInViewport(selector);
    await page.locator("#settings-btn").click();
    await visibleInViewport("#settings-done");
    await page.locator("#settings-done").click();
    await page.locator("#start-btn").click();
    await visibleInViewport("#hero-confirm");
    await page.locator("#hero-confirm").click();
    await page.locator("#mulligan-confirm").click();
    await page.waitForFunction(() => !EmberFX.busy);
    const rects = await page
      .locator("#power-btn,#contract-open,#end-turn")
      .evaluateAll((xs) => xs.map((x) => x.getBoundingClientRect().toJSON()));
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i],
          b = rects[j];
        expect(
          Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
            Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)),
        ).toBe(0);
      }
    await page.locator("#contract-open").click();
    await expect(page.locator(".ritual-stones").first()).toBeVisible();
    await expect(page.locator("#toast")).not.toBeVisible();
    await page.locator(".modal-close").click();
    expect(errors).toEqual([]);
    await ctx.close();
  });
}
test("deck disclosure leaves useful list space and closing it never throws a stale toggle event", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?debug=1");
  await page.waitForFunction(() => window.Emberfall && !AtelierWorld.loading);
  for (let i = 0; i < 3; i++) {
    await page.locator("#collection-nav").click();
    if (await page.locator("#deck-tools").evaluate((el) => el.open))
      await page.locator("#deck-tools > summary").click();
    const r = await page.locator(".deck-list").boundingBox();
    expect(r.height).toBeGreaterThan(300);
    await openDeckTools(page);
    await page.locator("#deck-class").selectOption("morla");
    await page.locator(".modal-close").click();
  }
  await page.locator("#start-btn").click();
  expect(errors).toEqual([]);
});
